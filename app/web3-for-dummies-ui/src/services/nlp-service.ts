// src/services/nlp-service.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createLogger } from "@/utils/logger";

const logger = createLogger("NLP-Service");

const parsedCommandCache: Record<string, PaymentInstruction> = {};

// Predefined responses for common queries
const COMMON_PATTERNS: Record<string, PaymentInstruction> = {
  'balance': {
    isPayment: false,
    isBalanceCheck: true,
    isCompleteBalanceCheck: true,
    token: 'SOL',
    network: 'localnet',
    confidence: 1.0,
  },
  'show balance': {
    isPayment: false,
    isBalanceCheck: true,
    isCompleteBalanceCheck: true,
    token: 'SOL',
    network: 'localnet',
    confidence: 1.0,
  },
  'show all balances': {
    isPayment: false,
    isBalanceCheck: true,
    isCompleteBalanceCheck: true,
    token: 'SOL',
    network: 'localnet',
    confidence: 1.0,
  },
  'wallet balance': {
    isPayment: false,
    isBalanceCheck: true,
    isCompleteBalanceCheck: true,
    token: 'SOL',
    network: 'localnet',
    confidence: 1.0,
  },
  'sol balance': {
    isPayment: false,
    isBalanceCheck: true,
    isCompleteBalanceCheck: false,
    token: 'SOL',
    network: 'localnet',
    confidence: 1.0,
  },
  'mint 10 usdc': {
    isPayment: false,
    isBalanceCheck: false,
    isMintRequest: true,
    amount: 10,
    token: 'USDC',
    network: 'localnet',
    confidence: 1.0,
  },
  'mint usdc': {
    isPayment: false,
    isBalanceCheck: false,
    isMintRequest: true,
    amount: 100,
    token: 'USDC',
    network: 'localnet',
    confidence: 1.0,
  },
  'mint 50 usdc': {
    isPayment: false,
    isBalanceCheck: false,
    isMintRequest: true,
    amount: 50,  // This is explicitly 50, not 100
    token: 'USDC',
    network: 'localnet',
    confidence: 1.0,
  },
  'cleanup tokens': {
    isPayment: false,
    isBalanceCheck: false,
    isMintRequest: false,
    isTokenCleanup: true,
    cleanupTarget: "unknown",
    network: 'localnet',
    confidence: 1.0,
  },
  'remove unknown tokens': {
    isPayment: false,
    isBalanceCheck: false,
    isMintRequest: false,
    isTokenCleanup: true,
    cleanupTarget: "unknown",
    network: 'localnet',
    confidence: 1.0,
  },
  'cleanup unknown tokens': {
    isPayment: false,
    isBalanceCheck: false,
    isMintRequest: false,
    isTokenCleanup: true,
    cleanupTarget: "unknown",
    network: 'localnet',
    confidence: 1.0,
  },
  'cleanup adi tokens': {
    isPayment: false,
    isBalanceCheck: false,
    isMintRequest: false,
    isTokenCleanup: true,
    cleanupTarget: ["ADI"],
    network: 'localnet',
    confidence: 1.0,
  },
  'remove adi tokens': {
    isPayment: false,
    isBalanceCheck: false,
    isMintRequest: false,
    isTokenCleanup: true,
    cleanupTarget: ["ADI"],
    network: 'localnet',
    confidence: 1.0,
  },

  'burn adi tokens': {
    isPayment: false,
    isBalanceCheck: false,
    isMintRequest: false,
    isTokenCleanup: true,
    cleanupTarget: ["ADI"],
    burnTokens: true,
    network: 'localnet',
    confidence: 1.0,
  },
  'burn all adi tokens': {
    isPayment: false,
    isBalanceCheck: false,
    isMintRequest: false,
    isTokenCleanup: true,
    cleanupTarget: ["ADI"],
    burnTokens: true,
    network: 'localnet',
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
    network: 'localnet',
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
    network: 'localnet',
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
    network: 'localnet',
    confidence: 1.0,
  },
  'fix token names': {
    isPayment: false,
    isFixTokenNames: true,
    network: 'localnet',
    confidence: 1.0,
  },
  'fix tokens name': {  // Add this variation
    isPayment: false,
    isFixTokenNames: true,
    network: 'localnet',
    confidence: 1.0,
  },
  'fix tokens': {  // Add this shorter variation
    isPayment: false,
    isFixTokenNames: true,
    network: 'localnet',
    confidence: 1.0,
  },
  'delete all tokens': {
    isPayment: false,
    isBalanceCheck: false,
    isTokenCleanup: true,
    cleanupTarget: "all",
    network: 'localnet',
    confidence: 1.0,
  },
  'clean all tokens': {
    isPayment: false,
    isBalanceCheck: false,
    isTokenCleanup: true,
    cleanupTarget: "all",
    network: 'localnet',
    confidence: 1.0,
  },
  'remove all tokens': {
    isPayment: false,
    isBalanceCheck: false,
    isTokenCleanup: true,
    cleanupTarget: "all",
    network: 'localnet',
    confidence: 1.0,
  },
  'list all': {
    isPayment: false,
    isBalanceCheck: false,
    listAllTokens: true,
    network: 'localnet',
    confidence: 1.0,
  },
  'list all tokens': {
    isPayment: false,
    isBalanceCheck: false,
    listAllTokens: true,
    network: 'localnet',
    confidence: 1.0,
  },
  'show all tokens': {
    isPayment: false,
    isBalanceCheck: false,
    listAllTokens: true,
    network: 'localnet',
    confidence: 1.0,
  },
  'list tokens': {
    isPayment: false,
    isBalanceCheck: false,
    listAllTokens: true,
    network: 'localnet',
    confidence: 1.0,
  },
  'swap': {
    isPayment: false,
    isSwapRequest: true,
    fromToken: '',
    toToken: '',
    confidence: 1.0,
  },
  'swap tokens': {
    isPayment: false,
    isSwapRequest: true,
    fromToken: '',
    toToken: '',
    confidence: 1.0,
  },
  'token swap': {
    isPayment: false,
    isSwapRequest: true,
    fromToken: '',
    toToken: '',
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
};

export interface PaymentInstruction {
  isPayment: boolean;
  isBalanceCheck?: boolean;
  isCompleteBalanceCheck?: boolean;
  isMintRequest?: boolean;
  isTokenCleanup?: boolean;
  isSwapRequest?: boolean;
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
  confidence: number;
  raw?: any;
}

// Initialize Gemini API
// Replace with your actual API key
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

// Create a safe instance of the API
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

export async function parsePaymentInstruction(message: string): Promise<PaymentInstruction> {
  try {

    const normalizedInput = message.trim().toLowerCase();

    if (COMMON_PATTERNS[normalizedInput]) {
      logger.debug('Using predefined pattern match');
      return COMMON_PATTERNS[normalizedInput];
    }

    if (parsedCommandCache[normalizedInput]) {
      logger.debug('Using cached parsing result');
      return parsedCommandCache[normalizedInput];
    }

    let result: PaymentInstruction;
    // Only try Gemini if we have an API key
    if (genAI) {
      logger.debug("🤖 Attempting to parse with Gemini AI...");
      const geminiResult = await parseWithGemini(message);
      if (geminiResult) {
        logger.debug("✅ Successfully parsed with Gemini AI", geminiResult);
        result = geminiResult;

        if (geminiResult.confidence > 0.7) {
          parsedCommandCache[normalizedInput] = geminiResult;
        }

        return result;
      } else {
        logger.debug("⚠️ Gemini parsing returned null, falling back to regex");
        result = parseWithRegex(message);

        if (result.confidence > 0.8) {
          parsedCommandCache[normalizedInput] = result;
        }
      }
    } else {
      console.warn("⚠️ No Gemini API key found, using regex parser only");
    }

    // Fallback to regex-based parsing
    console.log("📝 Using regex-based parsing as fallback");
    return parseWithRegex(message);
  } catch (error) {
    console.error("❌ Error in parsePaymentInstruction:", error);
    console.log("📝 Falling back to regex parser due to error");
    return parseWithRegex(message);
  }
}

async function parseWithGemini(message: string): Promise<PaymentInstruction | null> {
  if (!genAI) return null;

  try {
    console.log("🔄 Using Gemini model: gemini-2.0-flash-lite");
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

    const prompt = `
    You are a cryptocurrency payment parser for a Solana wallet app running on localnet (localhost).

    Parse the following message for either:
    1. A cryptocurrency payment instruction, or
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

    IMPORTANT: A 'swap' command like "swap 1 SOL for USDC" is NOT a payment. It's a token exchange. Only identify 'isPayment' as true if the user explicitly says 'send', 'pay', 'transfer' funds TO an ADDRESS or recipient name.

    for token swap request? (true/false)
      - If true, set isPayment to false.
      - Extract from_token, to_token, and amount if present.
      - Example: "swap 1 SOL for USDC" -> isSwapRequest = true, isPayment = false, fromToken = "SOL", toToken = "USDC", amount = 1
      - Example: "swap 50 BONK to SOL" -> isSwapRequest = true, isPayment = false, fromToken = "BONK", toToken = "SOL", amount = 50

    
    For balance check requests:
    - If user just types "balance", "show balance", "show all balances" or similar without specifying any token, mark as isCompleteBalanceCheck = true
    - If specific token is mentioned (like "SOL balance"), set token = "SOL" and isCompleteBalanceCheck = false

    For token minting requests examples: 
    - "mint 10 USDC" -> amount = 10, token = "USDC"
    - "mint 25 NIX" -> amount = 25, token = "NIX" 
    - "mint 5 ADI" -> amount = 5, token = "ADI"
    - "mint BONK token" -> amount = 100, token = "BONK" (default amount only when no number specified)

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
      "isSwapRequest": true/false, // Add this
      "burnSpecificAmount": true/false,
      "burnAmount": number or null,
      "burnByMintAddress": true/false,
      "mintAddress": "address" or null,
      "listAllTokens": true/false,
      "cleanupTarget": "unknown" or ["TOKEN1", "TOKEN2"] or "all", // Added "all"
      "amount": number or null, // Amount for payment, mint, burn, or swap
      "token": "SOL" or other token name, or null, // Token for payment, balance, mint, burn
      "fromToken": "SOL" or other token name, or null, // Add this for swap
      "toToken": "SOL" or other token name, or null, // Add this for swap
      "network": "localnet" or "devnet" or "mainnet",
      "recipient": "address" or null, // Recipient for payment
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
      recipient: parsedResult.recipient || undefined,
      network: parsedResult.network || "localnet",
      confidence: parsedResult.confidence || 0.8,
      raw: parsedResult
    };
  } catch (error) {
    console.error("Gemini parsing error:", error);
    return null;
  }
}

// Keep the original regex parser as fallback
function parseWithRegex(message: string): PaymentInstruction {
  // Convert message to lowercase for case-insensitive matching
  const lowerMessage = message.toLowerCase();

  let network: "localnet" | "devnet" | "mainnet" = "localnet";

  const burnCommand = detectBurnCommand(message);
  if (burnCommand) {
    return burnCommand;
  }

  if (lowerMessage.includes("devnet") || lowerMessage.includes("dev net")) {
    network = "devnet";
  } else if (lowerMessage.includes("mainnet") || lowerMessage.includes("main net")) {
    network = "mainnet";
  } else if (lowerMessage.includes("localnet") || lowerMessage.includes("local net")) {
    network = "localnet"
  }

  if (lowerMessage.includes('mint') ||
    (lowerMessage.includes('create') && lowerMessage.includes('token'))) {

    // Extract token symbol (default to USDC if not specified)
    let token = 'USDC';
    let amount = 100; // Default amount

    const amountTokenPattern = /mint\s+(\d+(?:\.\d+)?)\s+([a-z]+)/i;
    const tokenOnlyPattern = /mint\s+([a-z]+)(?!\d)/i;

    // First try to match the pattern with amount
    const amountTokenMatch = lowerMessage.match(amountTokenPattern);
    if (amountTokenMatch) {
      amount = parseFloat(amountTokenMatch[1]);
      token = amountTokenMatch[2].toUpperCase();
      console.log(`Parsed mint command: ${amount} ${token}`);
    } else {
      // If no amount found, try to match just token
      const tokenOnlyMatch = lowerMessage.match(tokenOnlyPattern);
      if (tokenOnlyMatch) {
        token = tokenOnlyMatch[1].toUpperCase();
        console.log(`Parsed mint command with default amount: 100 ${token}`);
      }
    }

    return {
      isPayment: false,
      isBalanceCheck: false,
      isMintRequest: true,
      token,
      amount,
      network,
      confidence: 0.9
    };
  }
  // Common payment keywords
  const paymentKeywords = ['send', 'transfer', 'pay'];
  const balanceKeywords = ['balance', 'check balance', 'how much', 'show balance', 'available balance'];
  const tokenTypes = ['usdc', 'sol', 'usdt', 'eth'];

  // Check if the message contains payment intent
  const hasPaymentKeyword = paymentKeywords.some(keyword => lowerMessage.includes(keyword));


  const isBalanceCheck = balanceKeywords.some(keyword => lowerMessage.includes(keyword));
  if (isBalanceCheck) {

    let isCompleteBalanceCheck = lowerMessage === 'balance' ||
      lowerMessage === 'show balance' ||
      lowerMessage === 'show all balances' ||
      lowerMessage === 'check balance' ||
      lowerMessage === 'wallet balance';

    let token = 'SOL';
    for (const tokenType of tokenTypes) {
      if (lowerMessage.includes(tokenType)) {
        token = tokenType.toUpperCase();
        break;
      }
    }

    return {
      isPayment: false,
      isBalanceCheck: true,
      isCompleteBalanceCheck,
      token,
      network,
      confidence: 0.8,
    }
  }

  if (!hasPaymentKeyword) {
    return { isPayment: false, confidence: 0.9 };
  }
  // Pattern for "send X [TOKEN] to [ADDRESS]"
  // Improved regex that's more flexible with formatting
  const simplePaymentRegex = /(?:send|transfer|pay)\s+(\d+(?:\.\d+)?)\s*(usdc|sol|usdt|eth)?\s+(?:to|for)?\s*([a-zA-Z0-9]{32,44})/i;
  const match = message.match(simplePaymentRegex);

  // If we found a standard payment pattern
  if (match) {
    const amount = parseFloat(match[1]);
    // Default to SOL if no token specified (more common for Solana)
    const token = (match[2] || 'sol').toUpperCase();
    const recipient = match[3];

    // Basic validation
    const isValidAmount = !isNaN(amount) && amount > 0;
    const isValidAddress = recipient && recipient.length >= 32 && recipient.length <= 44;

    let confidence = 0.7; // Base confidence

    // Adjust confidence based on validations
    if (!isValidAmount) confidence -= 0.3;
    if (!isValidAddress) confidence -= 0.4;

    return {
      isPayment: true,
      amount: isValidAmount ? amount : undefined,
      token,
      recipient: isValidAddress ? recipient : undefined,
      confidence
    };
  }

  // Fallback: Try to extract pieces from less structured input
  const amountMatch = lowerMessage.match(/(\d+(?:\.\d+)?)\s*(usdc|sol|usdt|eth)?/i);
  const addressMatch = lowerMessage.match(/([a-zA-Z0-9]{32,44})/);

  if (amountMatch || addressMatch) {
    const amount = amountMatch ? parseFloat(amountMatch[1]) : undefined;
    const token = (amountMatch && amountMatch[2]) ? amountMatch[2].toUpperCase() : 'SOL';
    const recipient = addressMatch ? addressMatch[1] : undefined;

    return {
      isPayment: true,
      amount,
      token,
      recipient,
      confidence: 0.5 // Lower confidence for partial matches
    };
  }
  if (lowerMessage.includes("cleanup") || lowerMessage.includes("remove")) {
    // Default to unknown if no specific token is mentioned
    let cleanupTarget: "unknown" | string[] = "unknown";

    // Look for supported token symbols in the message
    const knownTokens = ["sol", "usdc", "adi", "nix", "bonk"];
    for (const token of knownTokens) {
      if (lowerMessage.includes(token)) {
        cleanupTarget = [token.toUpperCase()];
        break;
      }
    }

    return {
      isPayment: false,
      isBalanceCheck: false,
      isMintRequest: false,
      isTokenCleanup: true,
      cleanupTarget,
      network,
      confidence: 0.9
    };
  }

  // No payment details found
  return { isPayment: hasPaymentKeyword, confidence: 0.3 };
}

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