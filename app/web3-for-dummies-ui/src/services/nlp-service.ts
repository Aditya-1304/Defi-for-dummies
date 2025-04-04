// src/services/nlp-service.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface PaymentInstruction {
  isPayment: boolean;
  token?: string;
  amount?: number;
  recipient?: string;
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
    // Only try Gemini if we have an API key
    if (genAI) {
      console.log("🤖 Attempting to parse with Gemini AI...");
      const geminiResult = await parseWithGemini(message);
      if (geminiResult) {
        console.log("✅ Successfully parsed with Gemini AI", geminiResult);
        return geminiResult;
      } else {
        console.log("⚠️ Gemini parsing returned null, falling back to regex");
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
    
    Parse the following message for a cryptocurrency payment instruction.
    Extract the following information if present:
    1. Is this a payment instruction? (true/false)
    2. Amount to be sent (number)
    3. Cryptocurrency token (e.g., SOL, USDC)
    4. Recipient address
    
    For testing on localnet, always assume SOL is the default token if none is specified.
    Solana addresses are 32-44 characters long and consist of letters and numbers.
    
    Message: "${message}"
    
    Respond in JSON format only:
    {
      "isPayment": true/false,
      "amount": number or null,
      "token": "SOL" or other token name, or null,
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
      amount: typeof parsedResult.amount === 'number' ? parsedResult.amount : 
              (parsedResult.amount === null ? undefined : parseFloat(parsedResult.amount)),
      token: parsedResult.token || "SOL", // Default to SOL for localnet
      recipient: parsedResult.recipient || undefined,
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
  
  // Common payment keywords
  const paymentKeywords = ['send', 'transfer', 'pay'];
  const tokenTypes = ['usdc', 'sol', 'usdt', 'eth'];
  
  // Check if the message contains payment intent
  const hasPaymentKeyword = paymentKeywords.some(keyword => lowerMessage.includes(keyword));
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