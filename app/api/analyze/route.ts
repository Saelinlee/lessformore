import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini SDK using GEMINI_API_KEY from .env.local
const ai = new GoogleGenAI();

const DEX_CATEGORY_ENUM = [
  "street_snack",
  "cafe_bakery",
  "local_meal",
  "transit_pass",
  "kbeauty_hair",
  "shopping_haul",
  "nightlife_bbq",
  "vip_flex",
];

// Calculate Singapore final price: GST (9%) is compounded on top of Service Charge (10%)
// Both selected => 1.10 * 1.09 = 1.199 (matches standard Singapore ++ pricing)
function calculateSingaporeFinalSgd(
  basePrice: number,
  hasServiceCharge: boolean,
  hasGst: boolean
): number {
  const svcMultiplier = hasServiceCharge ? 1.1 : 1.0;
  const gstMultiplier = hasGst ? 1.09 : 1.0;
  return Number((basePrice * svcMultiplier * gstMultiplier).toFixed(2));
}

export async function POST(req: NextRequest) {
  try {
    const {
      mode, // "extract_menu" | "compare_item"
      imageBase64,
      mimeType,
      itemName,
      baseSgdPrice,
      isEstimated,
      neighborhood,
      exchangeRate,
      hasServiceCharge,
      hasGst,
      variationSeed,
    } = await req.json();

    // MODE 1: Extract menu items in strict spatial reading order (top-left -> bottom-left, then top-right -> bottom-right)
    if (mode === "extract_menu") {
      if (!imageBase64) {
        return NextResponse.json(
          { error: "Image payload is required for menu extraction." },
          { status: 400 }
        );
      }

      const extractResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            inlineData: {
              data: imageBase64,
              mimeType: mimeType || "image/jpeg",
            },
          },
          {
            text: "Extract all visible food/drink menu items and their SGD prices from this image following strict column-by-column spatial reading order.",
          },
        ],
        config: {
          systemInstruction: `You are a precision menu OCR and spatial layout parser for Singapore cafes and restaurants.
          STRICT RULES:
          1. Output all item names 100% in English.
          2. SPATIAL READING ORDER: Read the menu strictly from TOP-LEFT to BOTTOM-LEFT first, and then from TOP-RIGHT to BOTTOM-RIGHT (column-by-column from left to right, top-to-bottom within each column). Preserve this exact order in the returned array.
          3. Extract each distinct food or drink item along with its base listed SGD price (numeric value before ++ tax/service charge).
          4. If the photo shows a single dish/drink without a visible price tag, return a single-item array with a realistic estimated Singapore price and set isEstimated to true.
          5. Exclude category headers—only include actual orderable items.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    baseSgdPrice: { type: Type.NUMBER },
                    isEstimated: { type: Type.BOOLEAN },
                  },
                  required: ["name", "baseSgdPrice", "isEstimated"],
                },
              },
            },
            required: ["items"],
          },
        },
      });

      const extracted = JSON.parse(extractResponse.text || '{"items":[]}');
      return NextResponse.json(extracted);
    }

    // MODE 2: Flexible, price-accurate Seoul opportunity cost comparison
    const numericBase = Number(baseSgdPrice);
    const applySvc = Boolean(hasServiceCharge);
    const applyGst = Boolean(hasGst);
    const finalSgd = calculateSingaporeFinalSgd(numericBase, applySvc, applyGst);
    const exactKrw = Math.round(finalSgd * Number(exchangeRate));

    const taxLabel =
      applySvc && applyGst
        ? "10% Service Charge + 9% GST (++)"
        : applySvc
        ? "10% Service Charge only"
        : applyGst
        ? "9% GST only"
        : "Nett (No extra tax/svc)";

    const compareResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          text: `Singapore Spend Item: "${itemName}"
          Base SGD Price: $${numericBase.toFixed(2)}
          Tax Applied: ${taxLabel}
          Final SG Cost: $${finalSgd.toFixed(2)} SGD
          Exact Seoul Buying Power: ₩${exactKrw.toLocaleString()} KRW
          Target Seoul Neighborhood: ${neighborhood}
          Creative Angle Seed: ${variationSeed || 1}`,
        },
      ],
      config: {
        systemInstruction: `You are a witty, street-smart Seoul local wingman for "Less for More" (Less in SG for More in Seoul), helping young Singaporeans save money for their upcoming Seoul trip.
        STRICT LANGUAGE RULE: Output ALL text, titles, descriptions, stamp titles, and nudge messages 100% in natural Singaporean-friendly English. Keep Korean terms in parentheses for local flavor, e.g., Airport Limousine Bus (공항 리무진버스) or Designer Haircut (디자이너 컷).

        CRITICAL PRICE CALIBRATION (2026 Seoul Reality):
        Match the exact KRW buying power (₩${exactKrw.toLocaleString()} KRW, within ±12%). NEVER suggest a cheap ₩7,000 snack when the budget is ₩25,000+, and NEVER suggest a ₩40,000 BBQ when the budget is ₩7,000!
        Scale your recommendations dynamically across ALL Seoul trip categories (Food, Cafes, K-Beauty/Haircuts, Airport Limo/KTX/Subway Passes, Olive Young/Daiso Hauls, Noraebang/Photo Booths/Hanbok Rental):
        - Under ₩9,000: Street food combos (tteokbokki + odeng), 1 bakery pastry + iced americano, convenience store feast, or 3+ subway rides.
        - ₩9,000 ~ ₩18,000: Full Korean meal (gukbap, bibimbap, kalguksu + mandu), specialty cafe dessert + drink set, or 1-hour Coin Noraebang + Life4Cuts photo booth + snacks.
        - ₩18,000 ~ ₩38,000: Round-trip Incheon Airport Limousine Bus ticket (₩34,000), trendy Seoul salon haircut & styling (₩25,000-₩35,000), Olive Young K-beauty haul, or a full Korean Fried Chicken & Beer (치맥) feast!
        - ₩38,000 ~ ₩75,000: Samgyeopsal / K-BBQ dinner for two, Personal Color analysis session, or full-day Hanbok rental + palace entry + cafe treat.
        - Over ₩75,000: Premium Hanwoo beef feast, K-beauty head spa / facial treatment, or round-trip flight ticket to Jeju!

        Make primaryCombo and alternativeCombo come from DIFFERENT angles when possible (e.g., if primaryCombo is a haircut or airport limousine bus, make alternativeCombo a food feast or Olive Young haul).
        Classify the primaryCombo into one of these exact dexCategoryId values: ${DEX_CATEGORY_ENUM.join(", ")}.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            itemName: { type: Type.STRING },
            baseSgdPrice: { type: Type.NUMBER },
            finalSgdPrice: { type: Type.NUMBER },
            isEstimated: { type: Type.BOOLEAN },
            krwAmount: { type: Type.INTEGER },
            valueBadge: { type: Type.STRING },
            dexCategoryId: {
              type: Type.STRING,
              enum: DEX_CATEGORY_ENUM,
            },
            primaryCombo: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                estimatedKrw: { type: Type.INTEGER },
                emoji: { type: Type.STRING },
                categoryTag: { type: Type.STRING },
                description: { type: Type.STRING },
              },
              required: [
                "title",
                "estimatedKrw",
                "emoji",
                "categoryTag",
                "description",
              ],
            },
            alternativeCombo: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                estimatedKrw: { type: Type.INTEGER },
                emoji: { type: Type.STRING },
              },
              required: ["title", "estimatedKrw", "emoji"],
            },
            stampTitle: { type: Type.STRING },
            nudgeMessage: { type: Type.STRING },
          },
          required: [
            "itemName",
            "baseSgdPrice",
            "finalSgdPrice",
            "isEstimated",
            "krwAmount",
            "valueBadge",
            "dexCategoryId",
            "primaryCombo",
            "alternativeCombo",
            "stampTitle",
            "nudgeMessage",
          ],
        },
      },
    });

    const parsedComparison = JSON.parse(compareResponse.text || "{}");
    // Enforce exact math consistency
    parsedComparison.baseSgdPrice = numericBase;
    parsedComparison.finalSgdPrice = finalSgd;
    parsedComparison.krwAmount = exactKrw;
    parsedComparison.isEstimated = Boolean(isEstimated);

    return NextResponse.json(parsedComparison);
  } catch (error) {
    console.error("Gemini API error:", error);
    return NextResponse.json(
      { error: "Unable to process request right now. Please try again." },
      { status: 500 }
    );
  }
}
