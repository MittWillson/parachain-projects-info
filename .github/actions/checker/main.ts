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
    // const changes: string[] = ['networks/westend/test.json']
    if (changes.length === 0) {
        return
    }

    const githubToken = actions.getInput('token')
    const sha = actions.getInput('sha')

    const pr = await getPRContent(githubToken, sha)

    const result = re.exec(pr.body)
    if (!result || result.length !== 3) {
        actions.setFailed('the PR Content is not expected')
        return
    }

    const signature = result[1].trim()
    const owner = result[2].trim()

    console.log('result', signature, owner)

    let verified = true

    await cryptoWaitReady();
    for (const file of changes) {
        if (!file.startsWith('networks/') || !file.endsWith('.json')) {
            continue
        }

        console.log('filename', file)

        // check signature
        const body = fs.readFileSync(file, 'utf8')
        if (body.length === 0) {
            continue
        }

        // polkadot apps paste replace method
        const secBody = body.replaceAll("\n", ' ')
        if (!isValidSignature(body, signature, owner) && !isValidSignature(secBody, signature, owner)) {
            actions.setFailed("the signature is not valid")
            verified = false
        }

        break
    }

    actions.setOutput('verified', verified ? 'true' : 'false')
}

main().then();
