const {cryptoWaitReady, decodeAddress, signatureVerify} = require('@polkadot/util-crypto');
const {u8aToHex} = require('@polkadot/util');
const actions = require('@actions/core')
const fs = require('fs')

const isValidSignature = (signedMessage, signature, address) => {
    const publicKey = decodeAddress(address);
    const hexPublicKey = u8aToHex(publicKey);

    return signatureVerify(signedMessage, signature, hexPublicKey).isValid;
};

const re = /The content signature is `([a-zA-Z\d ]+)` with account `([a-zA-Z\d ]+)`/

const main = async () => {
    const prContent: string = actions.getInput('prContent')
    const changes: string[] = actions.getInput('filenames').split('\r')
    // const changes: string[] = ['networks/polkadot/astar.json']
    if (changes.length === 0) {
        return
    }

    console.log("changes", changes)
    console.log("prContent", prContent)

    const result = re.exec(prContent)
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
