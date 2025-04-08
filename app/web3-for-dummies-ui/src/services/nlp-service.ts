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
  'mint 100 usdc': {
    isPayment: false,
    isBalanceCheck: false,
    isMintRequest: true,
    amount: 100,
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
};

export interface PaymentInstruction {
  isPayment: boolean;
  isBalanceCheck?: boolean;
  isCompleteBalanceCheck?: boolean;
  isMintRequest?: boolean;
  token?: string;
  amount?: number;
  recipient?: string;
  network? : "localnet" | "devnet" | "mainnet";
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

        if( result.confidence > 0.8) {
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
    
    Extract the following information if present:
    1. Is this a payment instruction? (true/false)
    2. Is this a balance check request? (true/false)
    3. Is this a complete balance check request without specific token? (true/false)
    4. Is this a token minting request? (true/false)
    5. Amount to be sent or minted (number) - for payments or minting
    6. Cryptocurrency token (e.g., SOL, USDC)
    7. Recipient address - for payments only
    8. Network specification (localnet, devnet, or mainnet) - default to localnet if not specified


    For balance check requests:
    - If user just types "balance", "show balance", "show all balances" or similar without specifying any token, mark as isCompleteBalanceCheck = true
    - If specific token is mentioned (like "SOL balance"), set token = "SOL" and isCompleteBalanceCheck = false

    For token minting requests: 
    - "mint 100 USDC" means create 100 USDC tokens
    - "create BONK token" means mint 100 BONK tokens (default amount)
    - "mint JUP" means mint 100 JUP tokens (default amount)
    
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
      "amount": number or null,
      "token": "SOL" or other token name, or null,
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
      isPayment: !!parsedResult.isPayment,
      isBalanceCheck: !!parsedResult.isBalanceCheck,
      isCompleteBalanceCheck: !!parsedResult.isCompleteBalanceCheck,
      isMintRequest: !!parsedResult.isMintRequest,
      amount: typeof parsedResult.amount === 'number' ? parsedResult.amount : 
              (parsedResult.amount === null ? undefined : parseFloat(parsedResult.amount)),
      token: parsedResult.token || "SOL", // Default to SOL for localnet
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

  if(lowerMessage.includes("devnet") || lowerMessage.includes("dev net")) {
    network = "devnet";
  }else if (lowerMessage.includes("mainnet") || lowerMessage.includes("main net")) {
    network = "mainnet";
  }else if (lowerMessage.includes("localnet") || lowerMessage.includes("local net")) {
    network = "localnet"
  }

  if (lowerMessage.includes('mint') || 
      (lowerMessage.includes('create') && lowerMessage.includes('token'))) {
    
    // Extract token symbol (default to USDC if not specified)
    let token = 'USDC';
    let amount = 100; // Default amount
    
    const tokenMatches = lowerMessage.match(/mint\s+(\d+)\s+([a-z]+)/i) || 
                          lowerMessage.match(/create\s+(\d+)\s+([a-z]+)/i) ||
                          lowerMessage.match(/mint\s+([a-z]+)/i) ||
                          lowerMessage.match(/create\s+([a-z]+)\s+token/i);
    
    if (tokenMatches && tokenMatches.length > 1) {
      if (tokenMatches.length > 2) {
        // Format is "mint 100 USDC"
        amount = parseFloat(tokenMatches[1]);
        token = tokenMatches[2].toUpperCase();
      } else {
        // Format is "mint USDC"
        token = tokenMatches[1].toUpperCase();
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
  const balanceKeywords = ['balance', 'check balance', 'how much','show balance','available balance'];
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
  
  // No payment details found
  return { isPayment: hasPaymentKeyword, confidence: 0.3 };
}