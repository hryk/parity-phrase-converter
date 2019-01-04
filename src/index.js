const fs = require('fs');
const process = require('process');
const {Command, flags} = require('@oclif/command');
const parityWordlist = require('@parity/wordlist');
const ethUtil = require('ethereumjs-util');
const Wallet = require('ethereumjs-wallet');
const hdkey = require('ethereumjs-wallet/hdkey');
const {cli} = require('cli-ux');

function fromParityPhrase(phrase) {
    let hash = ethUtil.keccak(Buffer.from(phrase), 256);
    for (let i = 0; i < 16384; i++) {
      hash = ethUtil.keccak(hash, 256);
    }
    while (ethUtil.privateToAddress(hash)[0] != 0) {
      hash = ethUtil.keccak(hash, 256);
    }
    return hash
}

class ParityPhraseConverterCommand extends Command {
    async run() {
        const {flags} = this.parse(ParityPhraseConverterCommand);
        const phrase = await cli.prompt("Type parity word phrase");
        if (parityWordlist.verifyPhrase(phrase)) {
            const privkey_buff = fromParityPhrase(phrase);
            const restored_wallet = Wallet.fromPrivateKey(privkey_buff);
            this.log("Address: " + restored_wallet.getChecksumAddressString());
            if (flags.privatekey === true) {
                this.log("Private Key: " + restored_wallet.getPrivateKeyString());
                process.exit(0);
            }
            // Export wallet as Web3 secret storage
            //  https://github.com/ethereum/wiki/wiki/Web3-Secret-Storage-Definition
            let password_confirmation = false;
            let confirmed_password = null;
            let num_try = 1;
            while (!password_confirmation) {
                const password = await cli.prompt("Type password to create web3 secret storage", {type: 'hide'});
                const password_confirm = await cli.prompt("Re-type password", {type: 'hide'});
                if (password === password_confirm) {
                    password_confirmation = true;
                    confirmed_password = password;
                }
                else {
                    if (num_try > 2) password_confirmation = true;
                    num_try += 1
                }
            }
            if (password_confirmation === true && confirmed_password !== null) {
                const keystore = restored_wallet.toV3(confirmed_password);
                fs.writeFile(flags.output, JSON.stringify(keystore), (err) => {
                    if (err) throw err;
                    this.log("Keystore is generated at: " + flags.output);
                });
            }
            else {
                this.log("Password confirmation failed.");
            }
        }
        else {
            this.log("Invalid phrase. Plese double check your input.");
        }
    }
}

ParityPhraseConverterCommand.description = "Parity phrase converter converts parity phrase to bip32 mnemonic phrase.";
ParityPhraseConverterCommand.flags = {
    "version": flags.version({"char": "v"}),
    "help": flags.help({"char": "h"}),
    "output": flags.string({"char": "o", "default": "keystore.json"}),
    "privatekey": flags.boolean({"char": "p", "default": false}),
};

module.exports = ParityPhraseConverterCommand;
