/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/web3_for_dummies.json`.
 */
export type Web3ForDummies = {
  "address": "B53vYkHSs1vMQzofYfKjz6Unzv8P4TwCcvvTbMWVnctv",
  "metadata": {
    "name": "web3ForDummies",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "processTransaction",
      "discriminator": [
        70,
        108,
        123,
        244,
        12,
        102,
        131,
        249
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "senderTokenAccount",
          "writable": true
        },
        {
          "name": "senderTokenAccountMint",
          "writable": true
        },
        {
          "name": "receiverTokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "events": [
    {
      "name": "transactionEvent",
      "discriminator": [
        164,
        87,
        102,
        61,
        105,
        53,
        147,
        32
      ]
    }
  ],
  "types": [
    {
      "name": "transactionEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "from",
            "type": "pubkey"
          },
          {
            "name": "to",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
