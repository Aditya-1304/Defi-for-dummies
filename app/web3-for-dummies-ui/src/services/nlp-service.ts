// src/services/nlp-service.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createLogger } from "@/utils/logger";

const logger = createLogger("NLP-Service");
let currentNetworkContext: "localnet" | "devnet" | "mainnet" = "devnet";

export function setNetworkContext(network: "localnet" | "devnet" | "mainnet"): void {
  console.log(`Setting network context to: ${network}`);
  currentNetworkContext = network;
}

export function getNetworkContext(): "localnet" | "devnet" | "mainnet" {
  return currentNetworkContext;
}
const parsedCommandCache: Record<string, PaymentInstruction> = {};

// Predefined responses for common queries
const COMMON_PATTERNS: Record<string, PaymentInstruction> = {
  'balance': {
    isPayment: false,
    isBalanceCheck: true,
    isCompleteBalanceCheck: true,
    token: 'SOL',
    network: 'devnet',
    confidence: 1.0,
  },
  'show balance': {
    isPayment: false,
    isBalanceCheck: true,
    isCompleteBalanceCheck: true,
    token: 'SOL',
    network: 'devnet',
    confidence: 1.0,
  },
  'show all balances': {
    isPayment: false,
    isBalanceCheck: true,
    isCompleteBalanceCheck: true,
    token: 'SOL',
    network: 'devnet',
    confidence: 1.0,
  },
  'wallet balance': {
    isPayment: false,
    isBalanceCheck: true,
    isCompleteBalanceCheck: true,
    token: 'SOL',
    network: 'devnet',
    confidence: 1.0,
  },
  'sol balance': {
    isPayment: false,
    isBalanceCheck: true,
    isCompleteBalanceCheck: false,
    token: 'SOL',
    network: 'devnet',
    confidence: 1.0,
  },
  'mint 10 usdc': {
    isPayment: false,
    isBalanceCheck: false,
    isMintRequest: true,
    amount: 10,
    token: 'USDC',
    network: 'devnet',
    confidence: 1.0,
  },
  'mint usdc': {
    isPayment: false,
    isBalanceCheck: false,
    isMintRequest: true,
    amount: 100,
    token: 'USDC',
    network: 'devnet',
    confidence: 1.0,
  },
  'mint 50 usdc': {
    isPayment: false,
    isBalanceCheck: false,
    isMintRequest: true,
    amount: 50,  // This is explicitly 50, not 100
    token: 'USDC',
    network: 'devnet',
    confidence: 1.0,
  },
  'cleanup tokens': {
    isPayment: false,
    isBalanceCheck: false,
    isMintRequest: false,
    isTokenCleanup: true,
    cleanupTarget: "unknown",
    network: 'devnet',
    confidence: 1.0,
  },
  'remove unknown tokens': {
    isPayment: false,
    isBalanceCheck: false,
    isMintRequest: false,
    isTokenCleanup: true,
    cleanupTarget: "unknown",
    network: 'devnet',
    confidence: 1.0,
  },
  'cleanup unknown tokens': {
    isPayment: false,
    isBalanceCheck: false,
    isMintRequest: false,
    isTokenCleanup: true,
    cleanupTarget: "unknown",
    network: 'devnet',
    confidence: 1.0,
  },
  'cleanup adi tokens': {
    isPayment: false,
    isBalanceCheck: false,
    isMintRequest: false,
    isTokenCleanup: true,
    cleanupTarget: ["ADI"],
    network: 'devnet',
    confidence: 1.0,
  },
  'remove adi tokens': {
    isPayment: false,
    isBalanceCheck: false,
    isMintRequest: false,
    isTokenCleanup: true,
    cleanupTarget: ["ADI"],
    network: 'devnet',
    confidence: 1.0,
  },

  'burn adi tokens': {
    isPayment: false,
    isBalanceCheck: false,
    isMintRequest: false,
    isTokenCleanup: true,
    cleanupTarget: ["ADI"],
    burnTokens: true,
    network: 'devnet',
    confidence: 1.0,
  },
  'burn all adi tokens': {
    isPayment: false,
    isBalanceCheck: false,
    isMintRequest: false,
    isTokenCleanup: true,
    cleanupTarget: ["ADI"],
    burnTokens: true,
    network: 'devnet',
    confidence: 1.0,
  },
  'burn 20 nix': {
    isPayment: false,
    isBalanceCheck: false,
    isMintRequest: false,
    isTokenCleanup: false,
    burnSpecificAmount: true,
    burnAmount: 20,
    token: 'NIX',
    network: 'devnet',
    confidence: 1.0,
  },
  'burn 10 nix': {
    isPayment: false,
    isBalanceCheck: false,
    isMintRequest: false,
    isTokenCleanup: false,
    burnSpecificAmount: true,
    burnAmount: 10,
    token: 'NIX',
    network: 'devnet',
    confidence: 1.0,
  },
  'burn 10 nix tokens': {
    isPayment: false,
    isBalanceCheck: false,
    isMintRequest: false,
    isTokenCleanup: false,
    burnSpecificAmount: true,
    burnAmount: 10,
    token: 'NIX',
    network: 'devnet',
    confidence: 1.0,
  },
  'fix token names': {
    isPayment: false,
    isFixTokenNames: true,
    network: 'devnet',
    confidence: 1.0,
  },
  'fix tokens name': {  // Add this variation
    isPayment: false,
    isFixTokenNames: true,
    network: 'devnet',
    confidence: 1.0,
  },
  'fix tokens': {  // Add this shorter variation
    isPayment: false,
    isFixTokenNames: true,
    network: 'devnet',
    confidence: 1.0,
  },
  'delete all tokens': {
    isPayment: false,
    isBalanceCheck: false,
    isTokenCleanup: true,
    cleanupTarget: "all",
    network: 'devnet',
    confidence: 1.0,
  },
  'clean all tokens': {
    isPayment: false,
    isBalanceCheck: false,
    isTokenCleanup: true,
    cleanupTarget: "all",
    network: 'devnet',
    confidence: 1.0,
  },
  'remove all tokens': {
    isPayment: false,
    isBalanceCheck: false,
    isTokenCleanup: true,
    cleanupTarget: "all",
    network: 'devnet',
    confidence: 1.0,
  },
  'list all': {
    isPayment: false,
    isBalanceCheck: false,
    listAllTokens: true,
    network: 'devnet',
    confidence: 1.0,
  },
  'list all tokens': {
    isPayment: false,
    isBalanceCheck: false,
    listAllTokens: true,
    network: 'devnet',
    confidence: 1.0,
  },
  'show all tokens': {
    isPayment: false,
    isBalanceCheck: false,
    listAllTokens: true,
    network: 'devnet',
    confidence: 1.0,
  },
  'list tokens': {
    isPayment: false,
    isBalanceCheck: false,
    listAllTokens: true,
    network: 'devnet',
    confidence: 1.0,
  },
  'swap': {
    isPayment: false,
    isSwapRequest: true,
    fromToken: '',
    toToken: '',
    amount: 1,
    confidence: 1.0,
  },
  'swap tokens': {
    isPayment: false,
    isSwapRequest: true,
    fromToken: '',
    toToken: '',
    amount: 1,
    confidence: 1.0,
  },
  'token swap': {
    isPayment: false,
    isSwapRequest: true,
    fromToken: '',
    toToken: '',
    amount: 1,
    confidence: 1.0,
  },
  'swap sol for usdc': {
    isPayment: false,
    isSwapRequest: true,
    fromToken: 'SOL',
    toToken: 'USDC',
    amount: 1,
    confidence: 1.0,
  },
  'swap usdc for sol': {
    isPayment: false,
    isSwapRequest: true,
    fromToken: 'USDC',
    toToken: 'SOL',
    amount: 1,
    confidence: 1.0,
  },
  'swap amount token for token': {
    isPayment: false,
    isSwapRequest: true,
    fromToken: '$2', // Placeholder for extracted token
    toToken: '$4',   // Placeholder for extracted token
    amount: 1,    // Placeholder for extracted amount
    confidence: 1.0, // High confidence
  },
  'swap amount token to token': { // Add the 'to' variation
    isPayment: false,
    isSwapRequest: true,
    fromToken: '$2',
    toToken: '$4',
    amount: 1,
    confidence: 1.0,
  },
  // Ensure payment patterns don't accidentally catch swaps
  'send amount token to address': {
    isPayment: true,
    isSwapRequest: false, // Explicitly false
    token: '$2',
    amount: 1,
    recipient: '$4',
    confidence: 1.0,
  },
  'exchange tokens': {
    isPayment: false,
    isSwapRequest: true,
    fromToken: '',
    toToken: '',
    amount: 1,
    confidence: 1.0,
  },

  'add liquidity': {
    isPayment: false,
    isAddLiquidity: true,
    tokenA: '',
    tokenB: '',
    amountA: 1,
    amountB: 1,
    network: 'devnet',
    confidence: 1.0,
  },
  'addliquidity': {
    isPayment: false,
    isAddLiquidity: true,
    tokenA: '',
    tokenB: '',
    amountA: 1,
    amountB: 1,
    network: 'devnet',
    confidence: 1.0,
  },
  'add pool': {
    isPayment: false,
    isAddLiquidity: true,
    tokenA: '',
    tokenB: '',
    amountA: 1,
    amountB: 1,
    network: 'devnet',
    confidence: 0.8,
  },
  'create pool': {
    isPayment: false,
    isAddLiquidity: false,
    isCreatePool: true, // This is the key difference
    tokenA: '',
    tokenB: '',
    amountA: 2,
    amountB: 2,
    network: 'devnet',
    confidence: 0.9,
  },
  'createpool': {
    isPayment: false,
    isAddLiquidity: false,
    isCreatePool: true,
    tokenA: '',
    tokenB: '',
    amountA: 2,
    amountB: 2,
    network: 'devnet',
    confidence: 0.9,
  },
  'check pool sol usdc': {
    isPayment: false,
    isPoolLiquidityCheck: true,
    tokenA: 'SOL',
    tokenB: 'USDC',
    network: 'devnet',
    confidence: 1.0,
  },
  'check pool usdc sol': {
    isPayment: false,
    isPoolLiquidityCheck: true,
    tokenA: 'USDC',
    tokenB: 'SOL',
    network: 'devnet',
    confidence: 1.0,
  },
  'unwrap sol': {
    isPayment: false,
    isUnwrapSol: true,
    network: 'devnet',
    confidence: 1.0,
  },
  'unwrap wsol': {
    isPayment: false,
    isUnwrapSol: true,
    network: 'devnet',
    confidence: 1.0,
  },
  'convert wsol to sol': {
    isPayment: false,
    isUnwrapSol: true,
    network: 'devnet',
    confidence: 1.0,
  },
  'close wsol': {
    isPayment: false,
    isUnwrapSol: true,
    network: 'devnet',
    confidence: 1.0,
  },
  'unwrap': {
    isPayment: false,
    isUnwrapSol: true,
    network: 'devnet',
    confidence: 0.9,
  }
};

export interface PaymentInstruction {
  isPayment: boolean;
  isBalanceCheck?: boolean;
  isCompleteBalanceCheck?: boolean;
  isMintRequest?: boolean;
  isTokenCleanup?: boolean;
  isSwapRequest?: boolean;
  isAddLiquidity?: boolean;
  isCreatePool?: boolean;
  isPoolLiquidityCheck?: boolean;
  isUnwrapSol?: boolean;
  isHelpRequest?: boolean;
  responseText?: string;
  tokenA?: string;
  tokenB?: string;
  amountA?: number;
  amountB?: number;
  cleanupTarget?: "unknown" | "all" | string[];
  burnTokens?: boolean;
  burnSpecificAmount?: boolean;
  burnAmount?: number;
  burnByMintAddress?: boolean;
  mintAddress?: string;
  listAllTokens?: boolean;
  isFixTokenNames?: boolean;
  token?: string;
  fromToken?: string;
  toToken?: string;
  amount?: number;
  recipient?: string;
  network?: "localnet" | "devnet" | "mainnet";
  estimatedReceiveAmount?: number;
  originalMessage?: string;
  needsConfirmation?: boolean;
  confidence: number;
  raw?: any;
}

// Initialize Gemini API
// Replace with your actual API key
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
const HELP_RESPONSE = `
Hello! I'm your AI agent buddy, here to help automate Solana transactions. Here's what I can do:

**Core Actions:**
- **Balance checks:** \`balance\`, \`list all tokens\`
- **Minting test tokens:** \`mint 10 USDC\`
- **Swapping tokens:** \`swap 1 SOL for USDC\`
- **Sending payments:** \`send 0.5 SOL to ADDRESS\`
- **Burning tokens:** \`burn 5 NIX\`, \`burn 10 from mint ADDRESS\`
- **Cleaning up tokens:** \`cleanup unknown tokens\`, \`cleanup all tokens\`
- **Unwrapping SOL:** \`unwrap sol\`
- **Fixing token names:** \`fix token names\`

**Liquidity Pool Actions:**
- **Creating liquidity pools:** \`create pool SOL USDC 1 200\`
- **Adding liquidity:** \`add liquidity SOL USDC 1 200\`
- **Checking pool liquidity:** \`check pool SOL USDC\`, \`show pool SOL USDC\`

**Options & Help:**
- **Specify Network:** Add \`on mainnet\` or \`on localnet\` (defaults to devnet)
- **Get Help:** \`help\`, \`hello\`

---

**A Little Note About Devnet:**

*   Some things may go wrong; this is just a demo and not a production-ready app.
*   Feel free to play around with it, but please be careful with your funds.
*   Devnet is generally slower than localnet; requests on Devnet may take longer to process.
*   Be careful with your tokens when adding liquidity; you cannot retrieve them back currently (this feature will be implemented in the future).
*   Transactions might sometimes fail to render correctly in the UI, but you won't lose your funds. Don't worry; always check the Solana Explorer for your transaction status.
*   Mainnet functionality is currently a placeholder (it doesn't work yet).
*   After switching networks, you can refresh the page to start a new chat or continue the same chat – both will work! ^_^

ENJOY!!
`;

// Create a safe instance of the API
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// export async function parsePaymentInstruction(message: string): Promise<PaymentInstruction> {
//   try {

//     const normalizedInput = message.trim().toLowerCase();

//     if (normalizedInput.includes("devnet")) {
//       setNetworkContext("devnet")
//     } else if (normalizedInput.includes("mainnet")) {
//       setNetworkContext("mainnet")
//     } else if (normalizedInput.includes("localnet")) {
//       setNetworkContext("localnet")
//     }

//     if (COMMON_PATTERNS[normalizedInput]) {
//       logger.debug('Using predefined pattern match');

//       const pattern = { ...COMMON_PATTERNS[normalizedInput] }

//       if ('network' in pattern) {
//         pattern.network = currentNetworkContext;
//       }
//       return pattern;
//     }

//     if (parsedCommandCache[normalizedInput]) {
//       logger.debug('Using cached parsing result');
//       return parsedCommandCache[normalizedInput];
//     }

//     if (lowerMessage === "hello" || lowerMessage === "help") {
//       logger.info(`Help request detected for: ${lowerMessage}`);
//       const helpInstruction: PaymentInstruction = {
//         isPayment: false,
//         isHelpRequest: true,
//         responseText: HELP_RESPONSE,
//         network: currentNetworkContext,
//         confidence: 1.0,
//       };
//       parsedCommandCache[cacheKey] = helpInstruction;
//       return helpInstruction;
//     }

//     let result: PaymentInstruction;
//     // Only try Gemini if we have an API key
//     if (genAI) {
//       logger.debug("🤖 Attempting to parse with Gemini AI...");
//       const geminiResult = await parseWithGemini(message);
//       if (geminiResult) {
//         logger.debug("✅ Successfully parsed with Gemini AI", geminiResult);
//         result = geminiResult;

//         if (geminiResult.confidence > 0.7) {
//           parsedCommandCache[normalizedInput] = geminiResult;
//         }

//         return result;
//       } else {
//         logger.debug("⚠️ Gemini parsing returned null, falling back to regex");
//         result = parseWithRegex(message);

//         if (result.confidence > 0.8) {
//           parsedCommandCache[normalizedInput] = result;
//         }
//       }
//     } else {
//       console.warn("⚠️ No Gemini API key found, using regex parser only");
//     }

//     // Fallback to regex-based parsing
//     console.log("📝 Using regex-based parsing as fallback");
//     return parseWithRegex(message);
//   } catch (error) {
//     console.error("❌ Error in parsePaymentInstruction:", error);
//     console.log("📝 Falling back to regex parser due to error");
//     return parseWithRegex(message);
//   }
// }
export async function parsePaymentInstruction(message: string): Promise<PaymentInstruction> {
  const addressRegex = /([A-Za-z0-9]{32,44})/;
  const addressMatch = message.match(addressRegex);
  const originalCaseAddress = addressMatch ? addressMatch[0] : null;

  const lowerMessage = message.trim().toLowerCase();
  const cacheKey = `${lowerMessage}_${currentNetworkContext}`; // Include network in cache key


  // 1. Check Cache
  if (parsedCommandCache[cacheKey]) {
    logger.debug(`Cache hit for: ${cacheKey}`);
    return parsedCommandCache[cacheKey];
  }

  // 2. Check for Help Keywords
  const greetings = ["hello", "help", "hi", "hii", "hey", "yo", "sup", "what's up", "wassup", "good morning", "good afternoon", "good evening"];
  if (greetings.includes(lowerMessage)) {
    logger.info(`Help/Greeting request detected for: ${lowerMessage}`);
    const helpInstruction: PaymentInstruction = {
      isPayment: false,
      isHelpRequest: true,
      responseText: HELP_RESPONSE,
      network: currentNetworkContext,
      confidence: 1.0,
      originalMessage: message,
    };
    parsedCommandCache[cacheKey] = helpInstruction; // Cache the help response
    return helpInstruction;
  }

  // 3. Check Common Patterns
  if (COMMON_PATTERNS[lowerMessage]) {
    logger.info(`Common pattern matched: ${lowerMessage}`);
    const instruction = {
      ...COMMON_PATTERNS[lowerMessage],
      network: COMMON_PATTERNS[lowerMessage].network || currentNetworkContext, // Ensure network context
      originalMessage: message,
    };
    parsedCommandCache[cacheKey] = instruction;
    return instruction;
  }

  // 4. Try Parsing with AI (if available and key exists)
  let instruction: PaymentInstruction | null = null;
  if (genAI) {
    logger.info(`Parsing with AI: ${message}`);
    instruction = await parseWithGemini(message);
  }

  // 5. Fallback to Regex if AI failed, had low confidence, or wasn't used
  let useRegexFallback = false;
  if (!instruction) {
    // AI failed completely or wasn't used
    useRegexFallback = true;
    if (genAI) logger.warn(`AI parsing failed, falling back to regex for: ${message}`);
    else logger.info(`Parsing with Regex (no AI key): ${message}`);
  } else if (instruction.confidence < 0.7) {
    // AI confidence too low
    useRegexFallback = true;
    logger.warn(`AI parsing confidence low (${instruction.confidence}), falling back to regex for: ${message}`);
  } else {
    // AI confidence is high, BUT check if it looks like a generic non-match
    const isGenericNonMatch = !instruction.isPayment &&
      !instruction.isBalanceCheck &&
      !instruction.isMintRequest &&
      !instruction.isTokenCleanup &&
      !instruction.isSwapRequest &&
      !instruction.isAddLiquidity &&
      !instruction.isCreatePool &&
      !instruction.isPoolLiquidityCheck &&
      !instruction.isUnwrapSol &&
      !instruction.isHelpRequest && // Added help check
      !instruction.listAllTokens &&
      !instruction.isFixTokenNames;

    if (isGenericNonMatch) {
      // If it looks like a generic non-match from AI, try regex anyway
      logger.warn(`AI returned high confidence generic non-match, trying regex as fallback for: ${message}`);
      useRegexFallback = true;
    } else {
      // AI confidence is high and it identified a specific action
      logger.info(`Using AI result (confidence: ${instruction.confidence}) for: ${message}`);
    }
  }

  // If fallback is needed, run regex parser
  if (useRegexFallback) {
    const regexInstruction = parseWithRegex(message);
    // Optional: Decide if the regex result is better than a low-confidence AI result
    // For now, we'll just use the regex result if we decided to fall back.
    instruction = regexInstruction;
    logger.info(`Using Regex fallback result for: ${message}`);
  }


  // 6. Final Adjustments (Network, Confirmation, Original Message)
  // Ensure instruction is not null before proceeding
  if (!instruction) {
    // This should ideally not happen if regex always returns something,
    // but handle it just in case.
    logger.error(`Parsing failed completely for: ${message}`);
    // Return a default "not understood" instruction
    return {
      isPayment: false,
      isHelpRequest: true, // Trigger help response
      responseText: "Sorry, I couldn't understand that command.",
      network: currentNetworkContext,
      confidence: 0,
      originalMessage: message,
    };
  } // Store original message

  // Add simple confirmation logic (example)
  if (instruction.isPayment && instruction.amount && instruction.amount > 1 && instruction.token === 'SOL') {
    instruction.needsConfirmation = true;
  }
  if (instruction.isSwapRequest && instruction.amount && instruction.amount > 1 && instruction.fromToken === 'SOL') {
    instruction.needsConfirmation = true;
  }
  if (instruction?.isPayment && instruction.recipient && originalCaseAddress) {
    // Replace the lowercased address with the original case version
    instruction.recipient = originalCaseAddress;
  }
  // 7. Cache and Return
  parsedCommandCache[cacheKey] = instruction; // Cache the final result
  logger.info("Final Parsed Instruction:", instruction);
  return instruction;
}

async function parseWithGemini(message: string): Promise<PaymentInstruction | null> {
  if (!genAI) return null;

  try {
    console.log("🔄 Using Gemini model: gemini-2.0-flash-lite");
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

    const prompt = `
    You are a cryptocurrency payment parser for a Solana wallet app running on localnet (localhost).

    Parse the following message for either:
    1. A Sol payment instruction, or
    2. A balance check request.
    3. A token minting request (new feature)
    4. A token cleanup request (new feature)
    5. A token burning request (including burning by mint address)
    6. A token swap request

    IMPORTANT FOR MINT REQUESTS: Always extract the exact number specified in the command.
    - "mint 10 nix" should return amount = 10, not 100
    - "mint 15 adi" should return amount = 15, not 100
    - "mint 25 usdc" should return amount = 25, not 100
    - Only use 100 as default when no specific amount is provided (e.g. "mint usdc")

    
    Extract the following information if present:
    1. Is this a payment instruction? (true/false)
    2. Is this a balance check request? (true/false)
    3. Is this a complete balance check request without specific token? (true/false)
    4. Is this a token minting request? (true/false)
    5. Is this a token cleanup request? (true/false)
    6. Is this a request to list all tokens including unknown ones? (true/false)
    7. Is this a request to burn tokens by mint address? (true/false)
    8. Amount to be sent or minted (number) - for payments or minting
    9. Cryptocurrency token (e.g., SOL, USDC)
    10. Recipient address - for payments only
    11. Network specification (localnet, devnet, or mainnet) - default to localnet if not specified
    12. Mint address - for burning unknown tokens
    13. Is this a token swap request? (true/false)
    14. Is this a add liquidity request? (true/false)
    15. Is this a request to fix token names? (true/false)
    16. Is this a request to burn tokens? (true/false)
    17. Is this a request to remove unknown tokens? (true/false)
    18. Is this a request to remove all tokens? (true/false)
    19. Is this a request to remove specific tokens? (true/false)
    20. Is this a request to burn specific tokens? (true/false)
    21. Is this a request to create a pool? (true/false)
    22. Is this a request to check pool liquidity? (true/false)
    23. Is this a request to unwrap SOL? (true/false)
    24. Is this a request to convert wrapped SOL to SOL? (true/false)
    25. Is this a request for normal conversation? (true/false)


    IMPORTANT: A 'swap' command like "swap 1 SOL for USDC" is NOT a payment. It's a token exchange. Only identify 'isPayment' as true if the user explicitly says 'send', 'pay', 'transfer' funds TO an ADDRESS or recipient name.

    for token swap request? (true/false)
    - If true, set isPayment to false.
    - Extract from_token, to_token, and amount if present.
    - Example: "swap 1 SOL for USDC" -> isSwapRequest = true, isPayment = false, fromToken = "SOL", toToken = "USDC", amount = 1
    - Example: "swap 50 BONK to SOL" -> isSwapRequest = true, isPayment = false, fromToken = "BONK", toToken = "SOL", amount = 50

    for normal conversation:
    user will use hello hii detect it and return the user the already generated help response

    For pool liquidity checks:
    - "check pool liquidity sol usdc" -> isPoolLiquidityCheck = true, tokenA = "SOL", tokenB = "USDC"
    - "show pool details for usdc/nix" -> isPoolLiquidityCheck = true, tokenA = "USDC", tokenB = "NIX"

    For unwrapping SOL requests:
    - "unwrap sol" -> isUnwrapSol = true
    - "convert wsol to sol" -> isUnwrapSol = true
    - "unwrap my wrapped sol" -> isUnwrapSol = true
    - "close wsol account" -> isUnwrapSol = true
    

    
    For balance check requests:
    - If user just types "balance", "show balance", "show all balances" or similar without specifying any token, mark as isCompleteBalanceCheck = true
    - If specific token is mentioned (like "SOL balance"), set token = "SOL" and isCompleteBalanceCheck = false

    For token minting requests examples: 
    - "mint 10 USDC" -> amount = 10, token = "USDC"
    - "mint 25 NIX" -> amount = 25, token = "NIX" 
    - "mint 5 ADI" -> amount = 5, token = "ADI"
    - "mint BONK token" -> amount = 100, token = "BONK" (default amount only when no number specified)


    For adding liquidity to pools:
    - "add liquidity to usdc to sol" -> isAddLiquidity = true, tokenA = "USDC", tokenB = "SOL", amountA = 1, amountB = 1
    - "add liquidity usdc sol 5 10" -> isAddLiquidity = true, tokenA = "USDC", tokenB = "SOL", amountA = 5 , amountB = 10
 
   For token cleanup requests:
    - "cleanup tokens" -> isTokenCleanup = true, cleanupTarget = "unknown" (default to removing unknown tokens)
    - "remove unknown tokens" -> isTokenCleanup = true, cleanupTarget = "unknown"
    - "cleanup ADI tokens" -> isTokenCleanup = true, cleanupTarget = ["ADI"]
    - "delete all tokens" -> isTokenCleanup = true, cleanupTarget = "all" (removes all tokens except SOL)
    - "clean all tokens" -> isTokenCleanup = true, cleanupTarget = "all"
    - "remove all tokens" -> isTokenCleanup = true, cleanupTarget = "all"
  

    For token-specific burning:
    - "burn 20 NIX" -> burnSpecificAmount = true, burnAmount = 20, token = "NIX"
    - "burn 5.5 ADI" -> burnSpecificAmount = true, burnAmount = 5.5, token = "ADI"
    - "burn 100 USDC" -> burnSpecificAmount = true, burnAmount = 100, token = "USDC"

    For listing all tokens including unknown ones:
    - "list all tokens" -> listAllTokens = true
    - "show all tokens including unknown" -> listAllTokens = true
    - "show my tokens including unknown ones" -> listAllTokens = true

    For burning tokens by mint address:
    - "burn 10 from mint 5hAykmD4YGcQ7hfa3xNGEQ6EEAyCYgxWKgykD9ksZHit" -> burnByMintAddress = true, amount = 10, mintAddress = "5hAykmD4YGcQ7hfa3xNGEQ6EEAyCYgxWKgykD9ksZHit"
    - "burn 5.5 tokens from mint address ARV6QncqipgYiLW8dF3P5BYKpUebqWN5KJLnG6Rf5ycW" -> burnByMintAddress = true, amount = 5.5, mintAddress = "ARV6QncqipgYiLW8dF3P5BYKpUebqWN5KJLnG6Rf5ycW"
    - "burn 10 from mint 7rDjtHGH" -> burnByMintAddress = true, amount = 10, mintAddress = "7rDjtHGH"

    Important: Extract the complete mint address as provided, without adding or removing any characters. 
    If the user provides a partial mint address, use exactly what they provided.


    For example:
    - "Check my balance on devnet" -> network = "devnet" , isBalanceCheck = true
    - "Send 10 SOL to FwPnvvnMK2RVmZjaBwCZ6wgiNuAFkz4k1qvT36fkHojS" -> isPayment = true
    - "Mint 500 USDC" -> isMintRequest = true, amount = 500, token = "USDC"
    - "What's my SOL balance on localnet?" -> network = "localnet"
    - "Balance" -> network = "localnet" (default)
    
    For testing on localnet, always assume SOL is the default token if none is specified.
    Solana addresses are 32-44 characters long and consist of letters and numbers.
    
    Message: "${message}"
    
    Respond in JSON format only:
    {
      "isPayment": true/false,
      "isBalanceCheck": true/false,
      "isCompleteBalanceCheck": true/false,
      "isMintRequest": true/false,
      "isTokenCleanup": true/false,
      "isSwapRequest": true/false,
      "isAddLiquidity": true/false,
      "isCreatePool": true/false,
      "isPoolLiquidityCheck": true/false,
      "isUnwrapSol": true/false,
      "tokenA" : "token symbol" or null,
      "tokenB" : "token symbol" or null,
      "amountA": number or null,
      "amountB": number or null,
      "burnSpecificAmount": true/false,
      "burnAmount": number or null,
      "burnByMintAddress": true/false,
      "mintAddress": "address" or null,
      "listAllTokens": true/false,
      "cleanupTarget": "unknown" or ["TOKEN1", "TOKEN2"] or "all", 
      "amount": number or null, 
      "token": "SOL" or other token name, or null, 
      "fromToken": "SOL" or other token name, or null,
      "toToken": "SOL" or other token name, or null, 
      "network": "localnet" or "devnet" or "mainnet",
      "recipient": "address" or null, 
      "confidence": number between 0 and 1
    }
    `;
    console.log("✨ Sending prompt to Gemini API");
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log("Gemini raw response:", text);

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsedResult = JSON.parse(jsonMatch[0]);

    console.log("Parsed JSON:", parsedResult);

    // Format and validate the response
    return {
      isPayment: !!parsedResult.isPayment && !parsedResult.isSwapRequest, // Ensure swap isn't also payment
      isBalanceCheck: !!parsedResult.isBalanceCheck,
      isCompleteBalanceCheck: !!parsedResult.isCompleteBalanceCheck,
      isMintRequest: !!parsedResult.isMintRequest,
      isTokenCleanup: !!parsedResult.isTokenCleanup,
      isSwapRequest: !!parsedResult.isSwapRequest, // Extract swap flag
      isAddLiquidity: !!parsedResult.isAddLiquidity,
      isCreatePool: !!parsedResult.isCreatePool,
      isPoolLiquidityCheck: !!parsedResult.isPoolLiquidityCheck,
      isUnwrapSol: !!parsedResult.isUnwrapSol,
      tokenA: parsedResult.tokenA || undefined,
      tokenB: parsedResult.tokenB || undefined,
      amountA: parsedResult.amountA !== null && parsedResult.amountA !== undefined
        ? (typeof parsedResult.amountA === 'number'
          ? parsedResult.amountA
          : parseFloat(String(parsedResult.amountA)))
        : undefined,
      amountB: parsedResult.amountB !== null && parsedResult.amountB !== undefined
        ? (typeof parsedResult.amountB === 'number'
          ? parsedResult.amountB
          : parseFloat(String(parsedResult.amountB)))
        : undefined,
      burnSpecificAmount: !!parsedResult.burnSpecificAmount,
      burnAmount: parsedResult.burnAmount || undefined,
      burnByMintAddress: !!parsedResult.burnByMintAddress,
      mintAddress: parsedResult.mintAddress || undefined,
      listAllTokens: !!parsedResult.listAllTokens,
      cleanupTarget: parsedResult.cleanupTarget,
      burnTokens: parsedResult.burnTokens, // You have this, but it wasn't in the JSON spec? Add if needed.
      amount: parsedResult.amount !== null && parsedResult.amount !== undefined
        ? (typeof parsedResult.amount === 'number'
          ? parsedResult.amount
          : parseFloat(String(parsedResult.amount)))
        : parsedResult.isMintRequest && !parsedResult.amount ? 100 : undefined,
      token: parsedResult.token || "SOL",
      fromToken: parsedResult.fromToken || undefined, // Extract fromToken
      toToken: parsedResult.toToken || undefined,   // Extract toToken
      estimatedReceiveAmount: parsedResult.estimatedReceiveAmount || undefined,
      recipient: parsedResult.recipient || undefined,
      network: parsedResult.network || currentNetworkContext,
      confidence: parsedResult.confidence || 0.8,
      raw: parsedResult
    };
  } catch (error) {
    console.error("Gemini parsing error:", error);
    return null;
  }
}

// Keep the original regex parser as fallback
// function parseWithRegex(message: string): PaymentInstruction {
//   // Convert message to lowercase for case-insensitive matching
//   const lowerMessage = message.toLowerCase();

//   let network: "localnet" | "devnet" | "mainnet" = "devnet";

//   const burnCommand = detectBurnCommand(message);
//   if (burnCommand) {
//     return burnCommand;
//   }

//   if (lowerMessage.includes("devnet") || lowerMessage.includes("dev net")) {
//     network = "devnet";
//     setNetworkContext("devnet"); // Update context when explicitly specified
//   } else if (lowerMessage.includes("mainnet") || lowerMessage.includes("main net")) {
//     network = "mainnet";
//     setNetworkContext("mainnet"); // Update context when explicitly specified
//   } else if (lowerMessage.includes("localnet") || lowerMessage.includes("local net")) {
//     network = "localnet";
//     setNetworkContext("localnet"); // Update context when explicitly specified
//   }

//   const swapRegex = /(?:swap|exchange)\s+(\d+(?:\.\d+)?)\s+([a-z]+)\s+(?:to|for)\s+([a-z]+)/i;
//   const swapAltRegex = /swap\s+(\d+(?:\.\d+)?)\s+([a-z]+)\s+to\s+([a-z]+)/i;

//   const swapMatch = lowerMessage.match(swapRegex) || lowerMessage.match(swapAltRegex);

//   if (swapMatch) {
//     const amount = parseFloat(swapMatch[1]);
//     const fromToken = swapMatch[2].toUpperCase();
//     const toToken = swapMatch[3].toUpperCase();

//     // console.log(`Parsed swap command: ${amount} ${fromToken} to ${toToken}`);
//     let estimatedReceiveAmount = amount;
//     if (fromToken === "USDC" && toToken === "SOL") {
//       estimatedReceiveAmount = amount / 200;
//       console.log(`Value estimate: ${amount} USDC = ${estimatedReceiveAmount} SOL`);

//     } else if (fromToken === 'SOL' && toToken === 'USDC') {
//       estimatedReceiveAmount = amount * 200;
//       console.log(`Value estimate: ${amount} SOL = ${estimatedReceiveAmount} USDC`);
//     }

//     return {
//       isPayment: false,
//       isSwapRequest: true,
//       amount,
//       fromToken,
//       toToken,
//       estimatedReceiveAmount,
//       network,
//       confidence: 0.95
//     };
//   }

//   // Also check for general swap keywords
//   if (lowerMessage.includes('swap') || lowerMessage.includes('exchange')) {
//     return {
//       isPayment: false,
//       isSwapRequest: true,
//       fromToken: '',
//       toToken: '',
//       amount: 1,
//       network,
//       confidence: 0.7
//     };
//   }

//   if (lowerMessage.includes('mint') ||
//     (lowerMessage.includes('create') && lowerMessage.includes('token'))) {

//     // Extract token symbol (default to USDC if not specified)
//     let token = 'USDC';
//     let amount = 100; // Default amount

//     const amountTokenPattern = /mint\s+(\d+(?:\.\d+)?)\s+([a-z]+)/i;
//     const tokenOnlyPattern = /mint\s+([a-z]+)(?!\d)/i;

//     // First try to match the pattern with amount
//     const amountTokenMatch = lowerMessage.match(amountTokenPattern);
//     if (amountTokenMatch) {
//       amount = parseFloat(amountTokenMatch[1]);
//       token = amountTokenMatch[2].toUpperCase();
//       console.log(`Parsed mint command: ${amount} ${token}`);
//     } else {
//       // If no amount found, try to match just token
//       const tokenOnlyMatch = lowerMessage.match(tokenOnlyPattern);
//       if (tokenOnlyMatch) {
//         token = tokenOnlyMatch[1].toUpperCase();
//         console.log(`Parsed mint command with default amount: 100 ${token}`);
//       }
//     }

//     return {
//       isPayment: false,
//       isBalanceCheck: false,
//       isMintRequest: true,
//       token,
//       amount,
//       network,
//       confidence: 0.9
//     };
//   }
//   // Common payment keywords
//   const paymentKeywords = ['send', 'transfer', 'pay'];
//   const balanceKeywords = ['balance', 'check balance', 'how much', 'show balance', 'available balance'];
//   const tokenTypes = ['usdc', 'sol', 'usdt', 'eth'];

//   // Check if the message contains payment intent
//   const hasPaymentKeyword = paymentKeywords.some(keyword => lowerMessage.includes(keyword));


//   const isBalanceCheck = balanceKeywords.some(keyword => lowerMessage.includes(keyword));
//   if (isBalanceCheck) {

//     let isCompleteBalanceCheck = lowerMessage === 'balance' ||
//       lowerMessage === 'show balance' ||
//       lowerMessage === 'show all balances' ||
//       lowerMessage === 'check balance' ||
//       lowerMessage === 'wallet balance';

//     let token = 'SOL';
//     for (const tokenType of tokenTypes) {
//       if (lowerMessage.includes(tokenType)) {
//         token = tokenType.toUpperCase();
//         break;
//       }
//     }

//     return {
//       isPayment: false,
//       isBalanceCheck: true,
//       isCompleteBalanceCheck,
//       token,
//       network,
//       confidence: 0.8,
//     }
//   }


//   const createPoolPattern = /(?:create\s+(?:pool|liquidity)|createpool)\s+([a-z]+)\s+([a-z]+)(?:\s+(\d+(?:\.\d+)?))?(?:\s+(\d+(?:\.\d+)?))?/i;
//   const createpoolMatch = lowerMessage.match(createPoolPattern);

//   if (createpoolMatch) {
//     return {
//       isPayment: false,
//       isBalanceCheck: false,
//       isCompleteBalanceCheck: false,
//       isMintRequest: false,
//       isTokenCleanup: false,
//       isSwapRequest: false,
//       isAddLiquidity: false,
//       isCreatePool: true,
//       tokenA: createpoolMatch[1],
//       tokenB: createpoolMatch[2],
//       amountA: parseFloat(createpoolMatch[3]) || 2,
//       amountB: parseFloat(createpoolMatch[4]) || 2,
//       network: "localnet",
//       confidence: 0.95
//     };
//   }

//   const addLiquidityRegex = /add\s+(?:liquidity|pool)\s+([a-z]+)\s+([a-z]+)(?:\s+(\d+(?:\.\d+)?))?(?:\s+(\d+(?:\.\d+)?))?/i;
//   const liquidityMatch = lowerMessage.match(addLiquidityRegex);
//   if (liquidityMatch || lowerMessage.includes("addliquidity")) {
//     let tokenA = '', tokenB = '';
//     let amountA = 1, amountB = 1;

//     if (liquidityMatch) {
//       tokenA = liquidityMatch[1].toUpperCase();
//       tokenB = liquidityMatch[2].toUpperCase();

//       if (liquidityMatch[3]) {
//         amountA = parseFloat(liquidityMatch[3]);
//       }

//       if (liquidityMatch[4]) {
//         amountB = parseFloat(liquidityMatch[4]);
//       }
//     }

//     return {
//       isPayment: false,
//       isAddLiquidity: true,
//       tokenA,
//       tokenB,
//       amountA,
//       amountB,
//       network,
//       confidence: liquidityMatch ? 0.95 : 0.8
//     };
//   }

//   if (!hasPaymentKeyword) {
//     return { isPayment: false, confidence: 0.9 };
//   }


//   if (lowerMessage.includes('swap') || lowerMessage.includes('exchange')) {
//     return {
//       isPayment: false,
//       isSwapRequest: true,
//       fromToken: '',
//       toToken: '',
//       amount: 1,
//       network,
//       confidence: 0.7
//     };
//   }
//   // Pattern for "send X [TOKEN] to [ADDRESS]"
//   // Improved regex that's more flexible with formatting
//   const simplePaymentRegex = /(?:send|transfer|pay)\s+(\d+(?:\.\d+)?)\s*(usdc|sol|usdt|eth)?\s+(?:to|for)?\s*([a-zA-Z0-9]{32,44})/i;
//   const match = message.match(simplePaymentRegex);

//   // If we found a standard payment pattern
//   if (match) {
//     const amount = parseFloat(match[1]);
//     // Default to SOL if no token specified (more common for Solana)
//     const token = (match[2] || 'sol').toUpperCase();
//     const recipient = match[3];

//     // Basic validation
//     const isValidAmount = !isNaN(amount) && amount > 0;
//     const isValidAddress = recipient && recipient.length >= 32 && recipient.length <= 44;

//     let confidence = 0.7; // Base confidence

//     // Adjust confidence based on validations
//     if (!isValidAmount) confidence -= 0.3;
//     if (!isValidAddress) confidence -= 0.4;

//     return {
//       isPayment: true,
//       amount: isValidAmount ? amount : undefined,
//       token,
//       recipient: isValidAddress ? recipient : undefined,
//       confidence
//     };
//   }

//   // Fallback: Try to extract pieces from less structured input
//   const amountMatch = lowerMessage.match(/(\d+(?:\.\d+)?)\s*(usdc|sol|usdt|eth)?/i);
//   const addressMatch = lowerMessage.match(/([a-zA-Z0-9]{32,44})/);

//   if (amountMatch || addressMatch) {
//     const amount = amountMatch ? parseFloat(amountMatch[1]) : undefined;
//     const token = (amountMatch && amountMatch[2]) ? amountMatch[2].toUpperCase() : 'SOL';
//     const recipient = addressMatch ? addressMatch[1] : undefined;

//     return {
//       isPayment: true,
//       amount,
//       token,
//       recipient,
//       confidence: 0.5 // Lower confidence for partial matches
//     };
//   }
//   if (lowerMessage.includes("cleanup") || lowerMessage.includes("remove")) {
//     // Default to unknown if no specific token is mentioned
//     let cleanupTarget: "unknown" | string[] = "unknown";

//     // Look for supported token symbols in the message
//     const knownTokens = ["sol", "usdc", "adi", "nix", "bonk"];
//     for (const token of knownTokens) {
//       if (lowerMessage.includes(token)) {
//         cleanupTarget = [token.toUpperCase()];
//         break;
//       }
//     }

//     return {
//       isPayment: false,
//       isBalanceCheck: false,
//       isMintRequest: false,
//       isTokenCleanup: true,
//       cleanupTarget,
//       network,
//       confidence: 0.9
//     };
//   }

//   // No payment details found
//   return { isPayment: hasPaymentKeyword, confidence: 0.3 };
// }
// ... (keep imports, logger, context functions, COMMON_PATTERNS, HELP_RESPONSE, PaymentInstruction interface) ...

// Main parsing function using Regex as primary or fallback
function parseWithRegex(message: string): PaymentInstruction {
  const lowerMessage = message.toLowerCase().trim();
  let network: "localnet" | "devnet" | "mainnet" = currentNetworkContext; // Default to current context

  // --- 1. Network Detection ---
  // Check for explicit network specification first and update context
  const networkMatch = lowerMessage.match(/\b(on|network)\s+(localnet|devnet|mainnet)\b/);
  if (networkMatch) {
    network = networkMatch[2] as "localnet" | "devnet" | "mainnet";
    setNetworkContext(network); // Update global context
    logger.info(`Regex detected network override: ${network}`);
  }
  // Remove network specification for further parsing
  const messageWithoutNetwork = lowerMessage.replace(/\s*\b(on|network)\s+(localnet|devnet|mainnet)\b\s*/, '').trim();


  // --- 2. Specific High-Priority Commands ---

  // Help / Greetings
  const greetings = ["hello", "help", "hi", "hii", "hey", "yo", "sup", "what's up", "wassup", "good morning", "good afternoon", "good evening"];
  if (greetings.includes(messageWithoutNetwork)) {
    return { isPayment: false, isHelpRequest: true, responseText: HELP_RESPONSE, network, confidence: 1.0, originalMessage: message };
  }

  // Fix Token Names
  if (/^(fix|update)\s+(token|tokens)(\s+name)?s?$/.test(messageWithoutNetwork)) {
    return { isPayment: false, isFixTokenNames: true, network, confidence: 1.0, originalMessage: message };
  }

  // Unwrap SOL
  if (/^(unwrap|close|convert)\s+(wsol|sol|wrapped sol)\b(?:\s+to\s+sol)?$/.test(messageWithoutNetwork) || messageWithoutNetwork === 'unwrap') {
    return { isPayment: false, isUnwrapSol: true, network, confidence: 1.0, originalMessage: message };
  }

  // List All Tokens
  if (/^(list|show)\s+(all\s+)?tokens?(\s+including\s+unknown)?$/.test(messageWithoutNetwork) || messageWithoutNetwork === 'list all') {
    return { isPayment: false, listAllTokens: true, network, confidence: 1.0, originalMessage: message };
  }

  // Balance Checks (Improved)
  const balanceKeywords = ['balance', 'check balance', 'how much', 'show balance', 'available balance', 'wallet balance'];
  const balanceMatch = messageWithoutNetwork.match(/(?:balance|check balance|how much|show balance|available balance|wallet balance)(?:\s+(?:of|for)\s+([a-z0-9]+))?/i);
  const isBalanceCheck = balanceKeywords.some(keyword => messageWithoutNetwork.startsWith(keyword)); // Check start

  if (isBalanceCheck || balanceMatch) {
    const specificToken = balanceMatch?.[1]; // Check group 1 for specific token
    const isComplete = !specificToken && (messageWithoutNetwork === 'balance' || messageWithoutNetwork === 'show balance' || messageWithoutNetwork === 'show all balances' || messageWithoutNetwork === 'check balance' || messageWithoutNetwork === 'wallet balance');
    const token = specificToken ? specificToken.toUpperCase() : 'SOL'; // Default SOL
    return { isPayment: false, isBalanceCheck: true, isCompleteBalanceCheck: isComplete, token, network, confidence: 0.9, originalMessage: message };
  }

  // --- 3. Commands with Parameters ---

  // Minting
  const mintPattern = /mint\s+(?:(\d+(?:\.\d+)?)\s+)?([a-z0-9]+)(?:\s+tokens?)?/i;
  const mintMatch = messageWithoutNetwork.match(mintPattern);
  if (mintMatch) {
    const amount = mintMatch[1] ? parseFloat(mintMatch[1]) : 100; // Default 100 if amount omitted
    const token = mintMatch[2].toUpperCase();
    return { isPayment: false, isMintRequest: true, amount, token, network, confidence: 0.95, originalMessage: message };
  }

  // Swapping
  const swapPattern = /(?:swap|exchange)\s+(\d+(?:\.\d+)?)\s+([a-z0-9]+)\s+(?:to|for)\s+([a-z0-9]+)/i;
  const swapMatch = messageWithoutNetwork.match(swapPattern);
  if (swapMatch) {
    const amount = parseFloat(swapMatch[1]);
    const fromToken = swapMatch[2].toUpperCase();
    const toToken = swapMatch[3].toUpperCase();
    let estimatedReceiveAmount = amount; // Basic estimation
    if (fromToken === "USDC" && toToken === "SOL") estimatedReceiveAmount = amount / 200;
    else if (fromToken === 'SOL' && toToken === 'USDC') estimatedReceiveAmount = amount * 200;
    return { isPayment: false, isSwapRequest: true, amount, fromToken, toToken, estimatedReceiveAmount, network, confidence: 0.95, originalMessage: message };
  }
  // General swap keyword check (lower confidence)
  if (messageWithoutNetwork.includes('swap') || messageWithoutNetwork.includes('exchange')) {
    return { isPayment: false, isSwapRequest: true, fromToken: '', toToken: '', amount: 1, network, confidence: 0.7, originalMessage: message };
  }

  // Burning Specific Amount (Integrated from detectBurnCommand)
  const burnSpecificPattern = /burn\s+(\d+(?:\.\d+)?)\s+([a-z0-9]+)(?:\s+tokens?)?/i;
  const burnSpecificMatch = messageWithoutNetwork.match(burnSpecificPattern);
  if (burnSpecificMatch) {
    const amount = parseFloat(burnSpecificMatch[1]);
    const token = burnSpecificMatch[2].toUpperCase();
    logger.info(`Regex detected burn command: ${amount} ${token}`);
    return { isPayment: false, burnSpecificAmount: true, burnAmount: amount, token, network, confidence: 0.95, originalMessage: message };
  }

  // Burning by Mint Address
  const burnMintPattern = /burn\s+(\d+(?:\.\d+)?)\s+(?:tokens?\s+)?from\s+mint(?:\s+address)?\s+([a-zA-Z0-9]{32,44})/i;
  const burnMintMatch = messageWithoutNetwork.match(burnMintPattern);
  if (burnMintMatch) {
    const amount = parseFloat(burnMintMatch[1]);
    const mintAddress = burnMintMatch[2];
    return { isPayment: false, burnByMintAddress: true, burnAmount: amount, mintAddress, network, confidence: 0.95, originalMessage: message };
  }

  // Token Cleanup
  const cleanupPattern = /(?:cleanup|remove|delete|clean)\s+(.+)/i;
  const cleanupMatch = messageWithoutNetwork.match(cleanupPattern);
  if (cleanupMatch) {
    const target = cleanupMatch[1].trim();
    let cleanupTarget: "unknown" | "all" | string[] = "unknown"; // Default
    if (target === 'all tokens' || target === 'all') {
      cleanupTarget = "all";
    } else if (target === 'unknown tokens' || target === 'unknown') {
      cleanupTarget = "unknown";
    } else {
      const tokens = target.replace(/tokens?/, '').trim().split(/\s+/).map(t => t.toUpperCase());
      if (tokens.length > 0 && tokens[0] !== '') { // Check if tokens were actually extracted
        cleanupTarget = tokens;
      }
    }
    return { isPayment: false, isTokenCleanup: true, cleanupTarget, network, confidence: 0.9, originalMessage: message };
  }
  // Simpler cleanup commands
  if (messageWithoutNetwork === 'cleanup' || messageWithoutNetwork === 'cleanup tokens') {
    return { isPayment: false, isTokenCleanup: true, cleanupTarget: 'unknown', network, confidence: 0.85, originalMessage: message };
  }

  // Create Pool
  const createPoolPattern = /(?:create\s+pool|createpool)\s+([a-z0-9]+)\s+([a-z0-9]+)(?:\s+(\d+(?:\.\d+)?))?(?:\s+(\d+(?:\.\d+)?))?/i;
  const createPoolMatch = messageWithoutNetwork.match(createPoolPattern);
  if (createPoolMatch) {
    return {
      isPayment: false, isCreatePool: true,
      tokenA: createPoolMatch[1].toUpperCase(),
      tokenB: createPoolMatch[2].toUpperCase(),
      amountA: createPoolMatch[3] ? parseFloat(createPoolMatch[3]) : 2, // Default amount
      amountB: createPoolMatch[4] ? parseFloat(createPoolMatch[4]) : 2, // Default amount
      network, confidence: 0.95, originalMessage: message
    };
  }

  // Add Liquidity
  const addLiquidityPattern = /(?:add\s+liquidity|add\s+pool|addliquidity)\s+([a-z0-9]+)\s+([a-z0-9]+)(?:\s+(\d+(?:\.\d+)?))?(?:\s+(\d+(?:\.\d+)?))?/i;
  const addLiquidityMatch = messageWithoutNetwork.match(addLiquidityPattern);
  if (addLiquidityMatch) {
    return {
      isPayment: false, isAddLiquidity: true,
      tokenA: addLiquidityMatch[1].toUpperCase(),
      tokenB: addLiquidityMatch[2].toUpperCase(),
      amountA: addLiquidityMatch[3] ? parseFloat(addLiquidityMatch[3]) : 1, // Default amount
      amountB: addLiquidityMatch[4] ? parseFloat(addLiquidityMatch[4]) : 1, // Default amount
      network, confidence: 0.95, originalMessage: message
    };
  }

  // Check Pool Liquidity
  const checkPoolPattern = /(?:check|show)\s+pool(?:\s+liquidity|\s+details)?(?:\s+for)?\s+([a-z0-9]+)\s*(?:\/|\s+)\s*([a-z0-9]+)/i;
  const checkPoolMatch = messageWithoutNetwork.match(checkPoolPattern);
  if (checkPoolMatch) {
    return {
      isPayment: false, isPoolLiquidityCheck: true,
      tokenA: checkPoolMatch[1].toUpperCase(),
      tokenB: checkPoolMatch[2].toUpperCase(),
      network, confidence: 0.95, originalMessage: message
    };
  }

  // --- 4. Payment (Checked Last due to overlap potential) ---
  const paymentPattern = /(?:send|transfer|pay)\s+(\d+(?:\.\d+)?)\s*([a-z0-9]+)?\s+(?:to|for)?\s*([a-zA-Z0-9]{32,44})/i;
  const paymentMatch = messageWithoutNetwork.match(paymentPattern);
  if (paymentMatch) {
    const amount = parseFloat(paymentMatch[1]);
    const token = (paymentMatch[2] || 'SOL').toUpperCase(); // Default to SOL if token omitted
    const recipient = paymentMatch[3];
    const isValidAmount = !isNaN(amount) && amount > 0;
    const isValidAddress = recipient && recipient.length >= 32 && recipient.length <= 44;

    if (isValidAmount && isValidAddress) {
      return { isPayment: true, amount, token, recipient, network, confidence: 0.95, originalMessage: message };
    } else {
      // Return with lower confidence if parts are invalid
      return { isPayment: true, amount: isValidAmount ? amount : undefined, token, recipient: isValidAddress ? recipient : undefined, network, confidence: 0.6, originalMessage: message };
    }
  }

  // --- 5. Fallback / Not Understood ---
  logger.warn(`Regex parser couldn't fully understand: "${message}"`);
  // Return a generic "not understood" triggering the standard help response
  return {
    isPayment: false,
    isBalanceCheck: false,
    isCompleteBalanceCheck: false,
    isMintRequest: false,
    isTokenCleanup: false,
    isSwapRequest: false,
    isAddLiquidity: false,
    isCreatePool: false,
    isPoolLiquidityCheck: false,
    isUnwrapSol: false,
    isFixTokenNames: false,
    burnSpecificAmount: false,
    burnByMintAddress: false,
    listAllTokens: false,
    isHelpRequest: true, // Trigger help response
    responseText: HELP_RESPONSE, // Use the standard help response here
    network: currentNetworkContext, // Use current context for fallback
    confidence: 0.1, // Very low confidence
    originalMessage: message,
  };
}

// ... (rest of the file, including parsePaymentInstruction which calls parseWithRegex) ...
function detectBurnCommand(message: string): PaymentInstruction | null {
  // Match any variations of "burn X token(s)"
  const burnPattern = /burn\s+(\d+(?:\.\d+)?)\s+([a-z]+)(?:\s+tokens?)?/i;
  const match = message.match(burnPattern);

  if (match) {
    const amount = parseFloat(match[1]);
    const token = match[2].toUpperCase();

    console.log(`Detected burn command: ${amount} ${token}`);

    return {
      isPayment: false,
      isBalanceCheck: false,
      isMintRequest: false,
      isTokenCleanup: false,
      burnSpecificAmount: true,
      burnAmount: amount,
      token,
      network: "localnet",
      confidence: 0.95
    };
  }

  return null;
}