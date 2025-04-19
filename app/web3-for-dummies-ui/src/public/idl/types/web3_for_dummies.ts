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
      "name": "addLiquidity",
      "discriminator": [
        181,
        157,
        89,
        67,
        143,
        182,
        52,
        72
      ],
      "accounts": [
        {
          "name": "pool"
        },
        {
          "name": "poolAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "pool.token_a_mint",
                "account": "liquidityPool"
              },
              {
                "kind": "account",
                "path": "pool.token_b_mint",
                "account": "liquidityPool"
              }
            ]
          }
        },
        {
          "name": "tokenAMint"
        },
        {
          "name": "tokenBMint"
        },
        {
          "name": "userTokenAAccount",
          "writable": true
        },
        {
          "name": "userTokenBAccount",
          "writable": true
        },
        {
          "name": "tokenAVault",
          "writable": true
        },
        {
          "name": "tokenBVault",
          "writable": true
        },
        {
          "name": "userAuthority",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "amountA",
          "type": "u64"
        },
        {
          "name": "amountB",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializePool",
      "docs": [
        "Initializes a new liquidity pool with the given token mints.",
        "Creates the pool state account and associated token accounts (vaults) to hold the tokens."
      ],
      "discriminator": [
        95,
        180,
        10,
        172,
        84,
        174,
        232,
        40
      ],
      "accounts": [
        {
          "name": "tokenAMint",
          "docs": [
            "The mint account for Token A. Must be passed by the client."
          ]
        },
        {
          "name": "tokenBMint",
          "docs": [
            "The mint account for Token B. Must be passed by the client."
          ]
        },
        {
          "name": "pool",
          "docs": [
            "The LiquidityPool account to be created."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "tokenAMint"
              },
              {
                "kind": "account",
                "path": "tokenBMint"
              }
            ]
          }
        },
        {
          "name": "poolAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "tokenAMint"
              },
              {
                "kind": "account",
                "path": "tokenBMint"
              }
            ]
          }
        },
        {
          "name": "tokenAVault",
          "docs": [
            "The associated token account (vault) for Token A, owned by the pool_authority PDA."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "poolAuthority"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "tokenAMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenBVault",
          "docs": [
            "The associated token account (vault) for Token B, owned by the pool_authority PDA."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "poolAuthority"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "tokenBMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "initializer",
          "docs": [
            "The user initializing the pool (signer and payer)."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "processTransaction",
      "docs": [
        "A simple example instruction to transfer tokens between two accounts.",
        "(This seems separate from the swap logic, potentially for testing or another feature)"
      ],
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
          "name": "senderTokenAccountMint",
          "docs": [
            "The mint of the token being transferred."
          ]
        },
        {
          "name": "senderTokenAccount",
          "docs": [
            "The token account sending the tokens."
          ],
          "writable": true
        },
        {
          "name": "receiverTokenAccount",
          "docs": [
            "The token account receiving the tokens."
          ],
          "writable": true
        },
        {
          "name": "tokenProgram",
          "docs": [
            "SPL Token Program (or Token-2022 program)."
          ]
        },
        {
          "name": "authority",
          "docs": [
            "The authority (signer) authorizing the transfer."
          ],
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "swap",
      "docs": [
        "Swaps one token for another using the constant product formula.",
        "Requires the amount of token to send in and the minimum amount of token expected out (slippage protection)."
      ],
      "discriminator": [
        248,
        198,
        158,
        145,
        225,
        117,
        135,
        200
      ],
      "accounts": [
        {
          "name": "sourceMint",
          "docs": [
            "The mint account for the token being sent *in*."
          ]
        },
        {
          "name": "destinationMint",
          "docs": [
            "The mint account for the token being sent *out*."
          ]
        },
        {
          "name": "pool",
          "docs": [
            "The LiquidityPool account containing the state for this swap."
          ]
        },
        {
          "name": "poolAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "pool.token_a_mint",
                "account": "liquidityPool"
              },
              {
                "kind": "account",
                "path": "pool.token_b_mint",
                "account": "liquidityPool"
              }
            ]
          }
        },
        {
          "name": "userSourceTokenAccount",
          "docs": [
            "The user's token account for the token they are sending *in*."
          ],
          "writable": true
        },
        {
          "name": "userDestinationTokenAccount",
          "docs": [
            "The user's token account for the token they are receiving *out*."
          ],
          "writable": true
        },
        {
          "name": "tokenAVault",
          "docs": [
            "The pool's vault for Token A. Needs to be mutable for balance changes."
          ],
          "writable": true
        },
        {
          "name": "tokenBVault",
          "docs": [
            "The pool's vault for Token B. Needs to be mutable for balance changes."
          ],
          "writable": true
        },
        {
          "name": "userAuthority",
          "docs": [
            "The user performing the swap (signer)."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "amountIn",
          "type": "u64"
        },
        {
          "name": "minAmountOut",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "liquidityPool",
      "discriminator": [
        66,
        38,
        17,
        64,
        188,
        80,
        68,
        129
      ]
    }
  ],
  "events": [
    {
      "name": "liquidityAddedEvent",
      "discriminator": [
        220,
        104,
        7,
        39,
        147,
        1,
        194,
        142
      ]
    },
    {
      "name": "swapEvent",
      "discriminator": [
        64,
        198,
        205,
        232,
        38,
        8,
        113,
        226
      ]
    },
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
  "errors": [
    {
      "code": 6000,
      "name": "invalidMint",
      "msg": "Invalid token mint provided"
    },
    {
      "code": 6001,
      "name": "invalidDestinationMint",
      "msg": "Invalid destination token mint provided."
    },
    {
      "code": 6002,
      "name": "zeroAmount",
      "msg": "Input amount must be greater than zero."
    },
    {
      "code": 6003,
      "name": "poolIsEmpty",
      "msg": "Pool reserve is zero, cannot swap."
    },
    {
      "code": 6004,
      "name": "slippageExceeded",
      "msg": "Slippage tolerance exceeded."
    },
    {
      "code": 6005,
      "name": "calculationOverflow",
      "msg": "Calculation overflow during swap."
    },
    {
      "code": 6006,
      "name": "invalidVault",
      "msg": "Invalid vault account provided."
    },
    {
      "code": 6007,
      "name": "invalidOwner",
      "msg": "Invalid owner of the token account."
    },
    {
      "code": 6008,
      "name": "excessivePriceImpact",
      "msg": "Price impact too high"
    },
    {
      "code": 6009,
      "name": "disproportionateLiquidity",
      "msg": "Disproportionate liquidity provided"
    }
  ],
  "types": [
    {
      "name": "liquidityAddedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "amountA",
            "type": "u64"
          },
          {
            "name": "amountB",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "liquidityPool",
      "docs": [
        "Stores the state of a single liquidity pool."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tokenAMint",
            "docs": [
              "The mint address of the first token (Token A)."
            ],
            "type": "pubkey"
          },
          {
            "name": "tokenBMint",
            "docs": [
              "The mint address of the second token (Token B)."
            ],
            "type": "pubkey"
          },
          {
            "name": "tokenAVault",
            "docs": [
              "The address of the pool's vault (ATA) for Token A."
            ],
            "type": "pubkey"
          },
          {
            "name": "tokenBVault",
            "docs": [
              "The address of the pool's vault (ATA) for Token B."
            ],
            "type": "pubkey"
          },
          {
            "name": "bump",
            "docs": [
              "The bump seed used for the pool's PDA."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "swapEvent",
      "docs": [
        "Event emitted when a swap occurs."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "docs": [
              "The address of the pool where the swap happened."
            ],
            "type": "pubkey"
          },
          {
            "name": "user",
            "docs": [
              "The address of the user who performed the swap."
            ],
            "type": "pubkey"
          },
          {
            "name": "amountIn",
            "docs": [
              "The amount of tokens sent into the pool."
            ],
            "type": "u64"
          },
          {
            "name": "amountOut",
            "docs": [
              "The amount of tokens sent out of the pool."
            ],
            "type": "u64"
          },
          {
            "name": "sourceMint",
            "docs": [
              "The mint of the token sent into the pool."
            ],
            "type": "pubkey"
          },
          {
            "name": "destinationMint",
            "docs": [
              "The mint of the token sent out of the pool."
            ],
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "transactionEvent",
      "docs": [
        "Event emitted when a simple transfer occurs via `process_transaction`."
      ],
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
