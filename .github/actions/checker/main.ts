const {cryptoWaitReady, decodeAddress, signatureVerify} = require('@polkadot/util-crypto');
const {u8aToHex} = require('@polkadot/util');
const actions = require('@actions/core')

const {getOctokit, context} = require('@actions/github')

const fs = require('fs')

const isValidSignature = (signedMessage, signature, address) => {
    const publicKey = decodeAddress(address);
    const hexPublicKey = u8aToHex(publicKey);

    return signatureVerify(signedMessage, signature, hexPublicKey).isValid;
};

const getPRContent = async (token: string, sha: string) => {
    console.log('getPRContent', token, sha)
    const octKit = getOctokit(token)
    const result = await octKit.rest.repos.listPullRequestsAssociatedWithCommit({
        owner: context.repo.owner,
        repo: context.repo.repo,
        commit_sha: sha,
    });
    const pullRequests = result.data.filter((pullRequest) => pullRequest.state === 'open');
    if (pullRequests.length === 0) {
        return null
    }
    let pr = pullRequests.length > 0 && pullRequests[0];
    pullRequests.forEach(pullRequest => pullRequest.head.sha.startsWith(sha) && (pr = pullRequest));
    return pr
}

const re = /The content signature is `([a-zA-Z\d ]+)` with account `([a-zA-Z\d ]+)`/

const main = async () => {
    const changes: string[] = actions.getInput('filenames').split(' ')
    // const changes: string[] = ['networks/polkadot/astar.json']
    if (changes.length === 0) {
        return
    }

    console.log('changes', changes)

    const githubToken = actions.getInput('token')
    const sha = actions.getInput('sha')

    console.log("main", githubToken, sha)

    const pr = await getPRContent(githubToken, sha)

    console.log("changes", changes)
    console.log("prContent", pr)

    const result = re.exec(pr.body)
    if (!result || result.length !== 3) {
        actions.setFailed('the PR Content is not expected')
        return
    }

    const signature = result[1]
    const owner = result[2]


    await cryptoWaitReady();
    for (const change of changes) {
        if (!change.startsWith('networks/')) {
            continue
        }

        // check signature
        const body = fs.readFileSync(change, 'utf8')
        if (body.length === 0) {
            continue
        }

        if (!isValidSignature(body, signature, owner)) {
            actions.setFailed("the signature is not valid")
        }

        break
    }
}

main().then();
