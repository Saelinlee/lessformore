"use client";

import React, { useState, useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import {
  Camera,
  Plane,
  Sparkles,
  CheckCircle2,
  XCircle,
  Award,
  MapPin,
  Loader2,
  Coffee,
  Utensils,
  Car,
  CupSoda,
  RotateCcw,
  ChevronRight,
  ArrowLeft,
  X,
  ListChecks,
  Flame,
  Lock,
  Settings2,
  Calendar,
  Pencil,
  Swords,
  Dices,
} from "lucide-react";
import { compressImage } from "@/utils/compressImage";

// Supported Seoul neighborhoods
const NEIGHBORHOODS = [
  "Seongsu-dong",
  "Hongdae / Yeonnam",
  "Mangwon-dong",
  "Euljiro",
  "Myeongdong",
] as const;

type Neighborhood = (typeof NEIGHBORHOODS)[number];

// Quick 1-Tap Singapore impulse spend shortcuts with explicit Svc & GST defaults
const QUICK_PRESETS = [
  {
    label: "Starbucks Latte",
    price: 7.5,
    icon: Coffee,
    svcDefault: false,
    gstDefault: false,
  },
  {
    label: "KOI Bubble Tea",
    price: 6.2,
    icon: CupSoda,
    svcDefault: false,
    gstDefault: false,
  },
  {
    label: "Cafe Brunch",
    price: 24.0,
    icon: Utensils,
    svcDefault: true,
    gstDefault: true,
  },
  {
    label: "Grab Ride",
    price: 16.0,
    icon: Car,
    svcDefault: false,
    gstDefault: false,
  },
];

// Flexible 8-Category Seoul Experience Dex (AI populates the exact unlocked reward)
export type DexCategoryId =
  | "street_snack"
  | "cafe_bakery"
  | "local_meal"
  | "transit_pass"
  | "kbeauty_hair"
  | "shopping_haul"
  | "nightlife_bbq"
  | "vip_flex";

interface DexSlot {
  id: DexCategoryId;
  categoryLabel: string;
  placeholderTitle: string;
  placeholderEmoji: string;
  typicalKrwRange: string;
}

const SEOUL_DEX_SLOTS: DexSlot[] = [
  {
    id: "street_snack",
    categoryLabel: "Street Food",
    placeholderTitle: "Tteokbokki & Hotteok",
    placeholderEmoji: "🍢",
    typicalKrwRange: "₩5k–₩9k",
  },
  {
    id: "cafe_bakery",
    categoryLabel: "Cafe & Bakery",
    placeholderTitle: "Salt Bread & Specialty Latte",
    placeholderEmoji: "🥐",
    typicalKrwRange: "₩7k–₩14k",
  },
  {
    id: "local_meal",
    categoryLabel: "Soul Meal",
    placeholderTitle: "Gukbap / Kalguksu Feast",
    placeholderEmoji: "🍜",
    typicalKrwRange: "₩9k–₩16k",
  },
  {
    id: "transit_pass",
    categoryLabel: "Airport & Transit",
    placeholderTitle: "Airport Limousine / Climate Card",
    placeholderEmoji: "🚌",
    typicalKrwRange: "₩10k–₩35k",
  },
  {
    id: "kbeauty_hair",
    categoryLabel: "Hair & K-Beauty",
    placeholderTitle: "Seoul Salon Cut / Head Spa",
    placeholderEmoji: "💇‍♂️",
    typicalKrwRange: "₩25k–₩60k",
  },
  {
    id: "shopping_haul",
    categoryLabel: "Olive Young & Fun",
    placeholderTitle: "K-Beauty Haul / Photo Booth",
    placeholderEmoji: "🛍️",
    typicalKrwRange: "₩15k–₩40k",
  },
  {
    id: "nightlife_bbq",
    categoryLabel: "Chimaek & K-BBQ",
    placeholderTitle: "Samgyeopsal / Hipjiro Chimaek",
    placeholderEmoji: "🥩",
    typicalKrwRange: "₩22k–₩55k",
  },
  {
    id: "vip_flex",
    categoryLabel: "Seoul VIP Flex",
    placeholderTitle: "Hanwoo Beef / Personal Color",
    placeholderEmoji: "👑",
    typicalKrwRange: "₩60k+",
  },
];

// Gamified Traveler Ranks based on cumulative SGD saved
function getTravelerRank(saved: number) {
  if (saved >= 1000) {
    return {
      title: "Gangnam Baller",
      badge: "👑",
      color: "bg-amber-400 text-slate-950",
    };
  }
  if (saved >= 500) {
    return {
      title: "Hanwoo BBQ VIP",
      badge: "🥩",
      color: "bg-rose-400 text-slate-950",
    };
  }
  if (saved >= 200) {
    return {
      title: "Seongsu Cafe Hopper",
      badge: "🥐",
      color: "bg-emerald-300 text-slate-950",
    };
  }
  if (saved >= 50) {
    return {
      title: "Street Food Hunter",
      badge: "🍜",
      color: "bg-sky-300 text-slate-950",
    };
  }
  return {
    title: "Budget Backpacker",
    badge: "🎫",
    color: "bg-indigo-200 text-indigo-950",
  };
}

interface DetectedMenuItem {
  name: string;
  baseSgdPrice: number;
  isEstimated: boolean;
}

interface AnalysisResult {
  itemName: string;
  baseSgdPrice: number;
  finalSgdPrice: number;
  isEstimated: boolean;
  krwAmount: number;
  valueBadge: string;
  dexCategoryId: DexCategoryId;
  primaryCombo: {
    title: string;
    estimatedKrw: number;
    emoji: string;
    categoryTag: string;
    description: string;
  };
  alternativeCombo: {
    title: string;
    estimatedKrw: number;
    emoji: string;
  };
  stampTitle: string;
  nudgeMessage: string;
}

interface UnlockedRecord {
  dexCategoryId: DexCategoryId;
  customTitle: string;
  emoji: string;
  neighborhood: string;
  savedSgd: number;
  krwValue: number;
  date: string;
}

const EXCHANGE_RATE = 1045; // 1 SGD = 1,045 KRW

// Exact Singapore tax math helper:
// When both Service Charge (10%) and GST (9%) are active, multiplier = 1.10 * 1.09 = 1.199 (++)
function calculateFinalSgd(
  basePrice: number,
  hasServiceCharge: boolean,
  hasGst: boolean
): number {
  const svcMultiplier = hasServiceCharge ? 1.1 : 1.0;
  const gstMultiplier = hasGst ? 1.09 : 1.0;
  return Number((basePrice * svcMultiplier * gstMultiplier).toFixed(2));
}

// Human-readable tax suffix for UI display
function formatTaxSuffix(hasServiceCharge: boolean, hasGst: boolean): string {
  if (hasServiceCharge && hasGst) return "(++)";
  if (hasServiceCharge) return "(+10% Svc)";
  if (hasGst) return "(+9% GST)";
  return "(nett)";
}

// Price-tiered smart fallback ONLY if the network/API fails
function buildSmartTieredFallback(
  item: DetectedMenuItem,
  neighborhood: Neighborhood,
  hasServiceCharge: boolean,
  hasGst: boolean
): AnalysisResult {
  const finalSgd = calculateFinalSgd(
    item.baseSgdPrice,
    hasServiceCharge,
    hasGst
  );
  const krw = Math.round(finalSgd * EXCHANGE_RATE);

  if (krw >= 45000) {
    return {
      itemName: item.name,
      baseSgdPrice: item.baseSgdPrice,
      finalSgdPrice: finalSgd,
      isEstimated: item.isEstimated,
      krwAmount: krw,
      valueBadge: "VIP Experience Upgrade",
      dexCategoryId: "vip_flex",
      primaryCombo: {
        title: "1-on-1 Personal Color Analysis Session (퍼스널컬러 진단)",
        estimatedKrw: krw,
        emoji: "🎨",
        categoryTag: "K-Beauty Experience",
        description: `Instead of spending $${finalSgd.toFixed(2)} in SG, get a full Korean personal color & styling consultation near ${neighborhood}!`,
      },
      alternativeCombo: {
        title: "Premium Korean Hanwoo Beef BBQ Set (한우 구이 세트)",
        estimatedKrw: Math.round(krw * 0.95),
        emoji: "🥩",
      },
      stampTitle: "Personal Color Session",
      nudgeMessage: `₩${krw.toLocaleString()} unlocks a full Seoul K-beauty experience. Skip today and glow in Seoul!`,
    };
  }

  if (krw >= 22000) {
    return {
      itemName: item.name,
      baseSgdPrice: item.baseSgdPrice,
      finalSgdPrice: finalSgd,
      isEstimated: item.isEstimated,
      krwAmount: krw,
      valueBadge: "Full Service / Round-Trip",
      dexCategoryId: "kbeauty_hair",
      primaryCombo: {
        title: "Trendy Seoul Salon Haircut & Styling (디자이너 컷 & 스타일링)",
        estimatedKrw: krw,
        emoji: "💇‍♂️",
        categoryTag: "Hair & Grooming",
        description: `That $${finalSgd.toFixed(2)} SG spend covers a full designer haircut & wash in ${neighborhood}—or a round-trip Incheon Airport Limousine Bus!`,
      },
      alternativeCombo: {
        title: "Round-Trip Incheon Airport Limousine Bus (공항 리무진버스 왕복)",
        estimatedKrw: 34000,
        emoji: "🚌",
      },
      stampTitle: "Seoul Salon Haircut",
      nudgeMessage: `Why pay $${finalSgd.toFixed(2)} here when it covers your airport limousine transfer or a fresh Korean haircut?`,
    };
  }

  if (krw >= 11000) {
    return {
      itemName: item.name,
      baseSgdPrice: item.baseSgdPrice,
      finalSgdPrice: finalSgd,
      isEstimated: item.isEstimated,
      krwAmount: krw,
      valueBadge: "Full Meal + Fun",
      dexCategoryId: "local_meal",
      primaryCombo: {
        title: "Handmade Kalguksu + Steamed Mandu Set (칼국수 & 만두)",
        estimatedKrw: krw,
        emoji: "🍜",
        categoryTag: "Local Soul Food",
        description: `Skip this SG impulse buy and enjoy a hearty traditional meal in ${neighborhood} with change to spare!`,
      },
      alternativeCombo: {
        title: "Olive Young Sheet Mask & Lip Tint Haul (올리브영 쇼핑)",
        estimatedKrw: Math.round(krw * 0.95),
        emoji: "🛍️",
      },
      stampTitle: "Kalguksu & Mandu Feast",
      nudgeMessage: `$${finalSgd.toFixed(2)} SGD gets you a full sit-down feast in ${neighborhood}. Bank it!`,
    };
  }

  return {
    itemName: item.name,
    baseSgdPrice: item.baseSgdPrice,
    finalSgdPrice: finalSgd,
    isEstimated: item.isEstimated,
    krwAmount: krw,
    valueBadge: "2x Seoul Cafe Treat",
    dexCategoryId: "cafe_bakery",
    primaryCombo: {
      title: "Artisan Salt Bread + Iced Americano (소금빵 & 아메리카노)",
      estimatedKrw: krw,
      emoji: "🥐",
      categoryTag: "Cafe & Bakery",
      description: `Skip ${item.name} in SG today and enjoy ${neighborhood}'s famous bakery culture for the exact same price!`,
    },
    alternativeCombo: {
      title: "Spicy Tteokbokki + Fish Cake Skewer (떡볶이 & 어묵)",
      estimatedKrw: Math.max(4500, Math.round(krw * 0.9)),
      emoji: "🍢",
    },
    stampTitle: "Seongsu Salt Bread Combo",
    nudgeMessage: `One drink here = a whole bakery break in ${neighborhood}. Save it for Seoul!`,
  };
}

export default function LessForMoreApp() {
  // Persistent gamification state
  const [savedSgd, setSavedSgd] = useState<number>(0);
  const [goalSgd, setGoalSgd] = useState<number>(1000);
  const [daysLeft, setDaysLeft] = useState<number>(45);
  const [streak, setStreak] = useState<number>(0);
  const [unlockedRecords, setUnlockedRecords] = useState<UnlockedRecord[]>([]);
  const [neighborhood, setNeighborhood] = useState<Neighborhood>("Seongsu-dong");

  // Separated Singapore Service Charge (10%) & GST (9%) toggle states
  const [hasServiceCharge, setHasServiceCharge] = useState<boolean>(true);
  const [hasGst, setHasGst] = useState<boolean>(true);

  // Active comparison & interactive editing state
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshingIdea, setRefreshingIdea] = useState<boolean>(false);
  const [loadingText, setLoadingText] = useState<string>("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [editablePrice, setEditablePrice] = useState<string>("");
  const [variationSeed, setVariationSeed] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<"scan" | "stamps">("scan");

  // Multi-item menu selection modal state
  const [detectedItems, setDetectedItems] = useState<DetectedMenuItem[]>([]);
  const [showMenuModal, setShowMenuModal] = useState<boolean>(false);
  const [showOtherItems, setShowOtherItems] = useState<boolean>(false);

  // Goal & D-Day settings modal state
  const [showGoalModal, setShowGoalModal] = useState<boolean>(false);
  const [tempGoal, setTempGoal] = useState<string>("1000");
  const [tempDays, setTempDays] = useState<string>("45");

  // Stamp unlock celebration modal
  const [celebrationStamp, setCelebrationStamp] = useState<{
    emoji: string;
    title: string;
    categoryLabel: string;
    savedSgd: number;
    newStreak: number;
  } | null>(null);

  // Toast notification popup state (100% English)
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "info" | "error";
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved progress from localStorage
  useEffect(() => {
    const storedSavings = localStorage.getItem("lfm_savings");
    const storedGoal = localStorage.getItem("lfm_goal");
    const storedDays = localStorage.getItem("lfm_days");
    const storedStreak = localStorage.getItem("lfm_streak");
    const storedStamps = localStorage.getItem("lfm_stamps_v2");
    const storedNeighborhood = localStorage.getItem("lfm_neighborhood");

    if (storedSavings) setSavedSgd(parseFloat(storedSavings));
    if (storedGoal) {
      setGoalSgd(parseFloat(storedGoal));
      setTempGoal(storedGoal);
    }
    if (storedDays) {
      setDaysLeft(parseInt(storedDays, 10));
      setTempDays(storedDays);
    }
    if (storedStreak) setStreak(parseInt(storedStreak, 10));
    if (storedStamps) setUnlockedRecords(JSON.parse(storedStamps));
    if (
      storedNeighborhood &&
      NEIGHBORHOODS.includes(storedNeighborhood as Neighborhood)
    ) {
      setNeighborhood(storedNeighborhood as Neighborhood);
    }
  }, []);

  // Show temporary English toast banner
  const triggerToast = (
    message: string,
    type: "success" | "info" | "error" = "info"
  ) => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Update target Seoul neighborhood and refresh active card if open
  const handleNeighborhoodChange = (newHood: Neighborhood) => {
    setNeighborhood(newHood);
    localStorage.setItem("lfm_neighborhood", newHood);
    triggerToast(`Target area switched to ${newHood}, Seoul!`, "info");

    if (result) {
      fetchAiComparison(
        {
          name: result.itemName,
          baseSgdPrice: result.baseSgdPrice,
          isEstimated: result.isEstimated,
        },
        hasServiceCharge,
        hasGst,
        newHood,
        variationSeed + 1,
        true
      );
    }
  };

  // Save updated Goal & D-Day countdown
  const handleSaveGoalSettings = () => {
    const parsedGoal = Math.max(50, parseFloat(tempGoal) || 1000);
    const parsedDays = Math.max(1, parseInt(tempDays, 10) || 45);
    setGoalSgd(parsedGoal);
    setDaysLeft(parsedDays);
    localStorage.setItem("lfm_goal", parsedGoal.toString());
    localStorage.setItem("lfm_days", parsedDays.toString());
    setShowGoalModal(false);
    triggerToast(
      `Trip goal updated: $${parsedGoal} SGD in ${parsedDays} days!`,
      "success"
    );
  };

  // Core AI comparison fetcher
  const fetchAiComparison = async (
    item: DetectedMenuItem,
    applySvc: boolean,
    applyGst: boolean,
    targetHood: Neighborhood = neighborhood,
    seed: number = 1,
    inlineRefresh = false
  ) => {
    setShowMenuModal(false);
    setVariationSeed(seed);

    const projectedSgd = calculateFinalSgd(
      item.baseSgdPrice,
      applySvc,
      applyGst
    );
    const projectedKrw = Math.round(projectedSgd * EXCHANGE_RATE);

    if (inlineRefresh) {
      setRefreshingIdea(true);
    } else {
      setLoading(true);
      setLoadingText(
        `Finding best ₩${projectedKrw.toLocaleString()} value in ${targetHood}...`
      );
      setResult(null);
    }

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "compare_item",
          itemName: item.name,
          baseSgdPrice: item.baseSgdPrice,
          isEstimated: item.isEstimated,
          neighborhood: targetHood,
          exchangeRate: EXCHANGE_RATE,
          hasServiceCharge: applySvc,
          hasGst: applyGst,
          variationSeed: seed,
        }),
      });

      if (!response.ok) {
        throw new Error("Comparison request failed");
      }

      const data: AnalysisResult = await response.json();
      setResult(data);
      if (!inlineRefresh) {
        setEditablePrice(data.baseSgdPrice.toFixed(2));
      }
    } catch (err) {
      console.error(err);
      const fallbackData = buildSmartTieredFallback(
        item,
        targetHood,
        applySvc,
        applyGst
      );
      setResult(fallbackData);
      if (!inlineRefresh) {
        setEditablePrice(fallbackData.baseSgdPrice.toFixed(2));
      }
    } finally {
      setLoading(false);
      setRefreshingIdea(false);
    }
  };

  // Step 1: Extract menu items from camera/gallery photo (top-left -> bottom-left, then top-right -> bottom-right)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setLoadingText("Scanning menu items (left-to-right)...");
    setResult(null);

    try {
      const compressed = await compressImage(file);

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "extract_menu",
          imageBase64: compressed.base64,
          mimeType: compressed.mimeType,
        }),
      });

      if (!response.ok) {
        throw new Error("Menu extraction failed");
      }

      const data: { items: DetectedMenuItem[] } = await response.json();
      const items = data.items || [];

      if (items.length === 0) {
        setLoading(false);
        triggerToast(
          "No menu items spotted in that shot. Try scanning closer or tap a quick simulator below!",
          "error"
        );
        return;
      }

      if (items.length === 1) {
        await fetchAiComparison(
          items[0],
          hasServiceCharge,
          hasGst,
          neighborhood,
          1,
          false
        );
      } else {
        setLoading(false);
        setDetectedItems(items);
        setShowOtherItems(false);
        setShowMenuModal(true);
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
      triggerToast(
        "Couldn't read that photo clearly. Try a sharper shot or tap a quick simulator below!",
        "error"
      );
    } finally {
      e.target.value = "";
    }
  };

  // Shared helper when toggling either Service Charge (10%) or GST (9%)
  const applyTaxUpdateToActiveResult = (nextSvc: boolean, nextGst: boolean) => {
    if (!result) return;

    const recalculatedSgd = calculateFinalSgd(
      result.baseSgdPrice,
      nextSvc,
      nextGst
    );
    const recalculatedKrw = Math.round(recalculatedSgd * EXCHANGE_RATE);

    setResult({
      ...result,
      finalSgdPrice: recalculatedSgd,
      krwAmount: recalculatedKrw,
    });

    fetchAiComparison(
      {
        name: result.itemName,
        baseSgdPrice: result.baseSgdPrice,
        isEstimated: result.isEstimated,
      },
      nextSvc,
      nextGst,
      neighborhood,
      variationSeed + 1,
      true
    );
  };

  const handleToggleServiceCharge = () => {
    const nextSvc = !hasServiceCharge;
    setHasServiceCharge(nextSvc);
    applyTaxUpdateToActiveResult(nextSvc, hasGst);
  };

  const handleToggleGst = () => {
    const nextGst = !hasGst;
    setHasGst(nextGst);
    applyTaxUpdateToActiveResult(hasServiceCharge, nextGst);
  };

  // Edit base SGD price inline and debounce AI recommendation refresh
  const handleManualPriceEdit = (val: string) => {
    setEditablePrice(val);
    const parsed = parseFloat(val);

    if (!isNaN(parsed) && parsed > 0 && result) {
      const recalculatedSgd = calculateFinalSgd(
        parsed,
        hasServiceCharge,
        hasGst
      );
      const recalculatedKrw = Math.round(recalculatedSgd * EXCHANGE_RATE);

      setResult({
        ...result,
        baseSgdPrice: parsed,
        finalSgdPrice: recalculatedSgd,
        krwAmount: recalculatedKrw,
      });

      if (editDebounceRef.current) {
        clearTimeout(editDebounceRef.current);
      }
      editDebounceRef.current = setTimeout(() => {
        fetchAiComparison(
          {
            name: result.itemName,
            baseSgdPrice: parsed,
            isEstimated: result.isEstimated,
          },
          hasServiceCharge,
          hasGst,
          neighborhood,
          variationSeed + 1,
          true
        );
      }, 650);
    }
  };

  // Shuffle another creative AI recommendation for the exact same price
  const handleShuffleIdea = () => {
    if (!result || refreshingIdea) return;
    fetchAiComparison(
      {
        name: result.itemName,
        baseSgdPrice: result.baseSgdPrice,
        isEstimated: result.isEstimated,
      },
      hasServiceCharge,
      hasGst,
      neighborhood,
      variationSeed + 1,
      true
    );
  };

  // Reward user when skipping the Singapore purchase & dynamically imprint into Stamp Dex
  const handleSkipAndSave = () => {
    if (!result) return;

    const updatedTotal = Number((savedSgd + result.finalSgdPrice).toFixed(2));
    const updatedStreak = streak + 1;

    setSavedSgd(updatedTotal);
    setStreak(updatedStreak);
    localStorage.setItem("lfm_savings", updatedTotal.toString());
    localStorage.setItem("lfm_streak", updatedStreak.toString());

    const validCategoryId: DexCategoryId = SEOUL_DEX_SLOTS.some(
      (s) => s.id === result.dexCategoryId
    )
      ? result.dexCategoryId
      : "cafe_bakery";

    const slotMeta =
      SEOUL_DEX_SLOTS.find((s) => s.id === validCategoryId) ||
      SEOUL_DEX_SLOTS[0];

    const newRecord: UnlockedRecord = {
      dexCategoryId: validCategoryId,
      customTitle: result.stampTitle || result.primaryCombo.title,
      emoji: result.primaryCombo.emoji,
      neighborhood,
      savedSgd: result.finalSgdPrice,
      krwValue: result.krwAmount,
      date: new Date().toLocaleDateString("en-SG", {
        day: "numeric",
        month: "short",
      }),
    };

    const filteredPrev = unlockedRecords.filter(
      (r) => r.dexCategoryId !== validCategoryId
    );
    const updatedRecords = [newRecord, ...filteredPrev];
    setUnlockedRecords(updatedRecords);
    localStorage.setItem("lfm_stamps_v2", JSON.stringify(updatedRecords));

    confetti({
      particleCount: 90,
      spread: 70,
      origin: { y: 0.65 },
    });

    setCelebrationStamp({
      emoji: result.primaryCombo.emoji,
      title: newRecord.customTitle,
      categoryLabel: slotMeta.categoryLabel,
      savedSgd: result.finalSgdPrice,
      newStreak: updatedStreak,
    });

    setResult(null);
  };

  // Handle user admitting they already spent the money (resets Skip Streak)
  const handleAlreadyPaid = () => {
    const hadStreak = streak > 0;
    setStreak(0);
    localStorage.setItem("lfm_streak", "0");

    triggerToast(
      hadStreak
        ? "Oof! Your Skip Streak reset to 0. Save the next one for Seoul!"
        : "No worries! Enjoy your treat—let's save the next one for Seoul!",
      "info"
    );
    setResult(null);
  };

  // Reset all gamification progress
  const handleResetProgress = () => {
    setSavedSgd(0);
    setStreak(0);
    setUnlockedRecords([]);
    localStorage.removeItem("lfm_savings");
    localStorage.removeItem("lfm_streak");
    localStorage.removeItem("lfm_stamps_v2");
    triggerToast("Savings tracker, streak, and stamp book reset.", "info");
  };

  const progressPercent = Math.min(100, Math.round((savedSgd / goalSgd) * 100));
  const remainingSgd = Math.max(0, goalSgd - savedSgd);
  const dailyTargetSgd = (remainingSgd / Math.max(1, daysLeft)).toFixed(2);
  const currentRank = getTravelerRank(savedSgd);
  const unlockedCategoryMap = new Map(
    unlockedRecords.map((r) => [r.dexCategoryId, r])
  );

  // Slice detected items for the 5-option popup (first 4 vs remaining after 4th)
  const firstFourItems = detectedItems.slice(0, 4);
  const remainingItems = detectedItems.slice(4);
  const hasMoreThanFour = remainingItems.length > 0;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-100 shadow-2xl">
      {/* Top English Toast Banner */}
      {toast && (
        <div className="fixed top-4 left-1/2 z-50 w-[90%] max-w-sm -translate-x-1/2 animate-bounce">
          <div
            className={`rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-xl ${
              toast.type === "success"
                ? "bg-emerald-600"
                : toast.type === "error"
                ? "bg-rose-600"
                : "bg-slate-900"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      {/* Stamp Unlock Celebration Modal */}
      {celebrationStamp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-5 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl border-2 border-amber-400 bg-white p-6 text-center shadow-2xl">
            <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold tracking-wide text-amber-800 uppercase">
              {celebrationStamp.categoryLabel} Stamp Unlocked!
            </span>
            <div className="mx-auto mt-4 flex h-24 w-24 items-center justify-center rounded-full bg-indigo-50 text-5xl shadow-inner">
              {celebrationStamp.emoji}
            </div>
            <h3 className="mt-4 text-xl font-black text-slate-900">
              {celebrationStamp.title}
            </h3>
            <p className="mt-1 text-sm font-bold text-emerald-600">
              +${celebrationStamp.savedSgd.toFixed(2)} SGD added to Seoul Fund
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3.5 py-1 text-xs font-extrabold text-orange-600">
              <Flame className="h-4 w-4 fill-orange-500" />
              <span>{celebrationStamp.newStreak} Skip Streak!</span>
            </div>
            <button
              onClick={() => setCelebrationStamp(null)}
              className="mt-6 w-full rounded-2xl bg-indigo-600 py-3.5 text-sm font-extrabold text-white shadow-md hover:bg-indigo-700"
            >
              Shiok! Keep Going
            </button>
          </div>
        </div>
      )}

      {/* Trip Goal & D-Day Settings Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-5 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-slate-900">
                Customize Seoul Goal
              </h3>
              <button
                onClick={() => setShowGoalModal(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase">
                  Target Seoul Trip Budget (SGD)
                </label>
                <input
                  type="number"
                  value={tempGoal}
                  onChange={(e) => setTempGoal(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase">
                  Days Until Seoul Flight (D-Day)
                </label>
                <input
                  type="number"
                  value={tempDays}
                  onChange={(e) => setTempDays(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <button
                onClick={handleSaveGoalSettings}
                className="w-full rounded-2xl bg-indigo-600 py-3 text-sm font-extrabold text-white shadow-md hover:bg-indigo-700"
              >
                Save Trip Target
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Item Menu Selection Popup Modal (1-4 items + 5th "Others") */}
      {showMenuModal && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-xs sm:items-center">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-indigo-600" />
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {showOtherItems
                      ? "More Menu Options"
                      : "Which Menu Item Are You Looking At?"}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Ordered top-to-bottom, left-to-right • Tap one to compare
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMenuModal(false)}
                aria-label="Close popup"
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 max-h-80 space-y-2.5 overflow-y-auto pr-1">
              {!showOtherItems ? (
                <>
                  {firstFourItems.map((item, idx) => (
                    <button
                      key={`${item.name}-${idx}`}
                      onClick={() =>
                        fetchAiComparison(
                          item,
                          hasServiceCharge,
                          hasGst,
                          neighborhood,
                          1,
                          false
                        )
                      }
                      className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-indigo-400 hover:bg-indigo-50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-extrabold text-indigo-700">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            {item.name}
                          </p>
                          {item.isEstimated && (
                            <span className="text-[10px] text-slate-400">
                              Estimated price
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-extrabold text-indigo-600">
                          ${item.baseSgdPrice.toFixed(2)}
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </div>
                    </button>
                  ))}

                  {hasMoreThanFour && (
                    <button
                      onClick={() => setShowOtherItems(true)}
                      className="flex w-full items-center justify-between rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/70 px-4 py-3 text-left transition hover:bg-indigo-100"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-extrabold text-white">
                          5
                        </span>
                        <div>
                          <p className="text-sm font-extrabold text-indigo-900">
                            Others
                          </p>
                          <p className="text-[11px] text-indigo-600">
                            Show {remainingItems.length} more menu{" "}
                            {remainingItems.length === 1 ? "item" : "items"}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-indigo-600" />
                    </button>
                  )}
                </>
              ) : (
                <>
                  {remainingItems.map((item, idx) => (
                    <button
                      key={`${item.name}-more-${idx}`}
                      onClick={() =>
                        fetchAiComparison(
                          item,
                          hasServiceCharge,
                          hasGst,
                          neighborhood,
                          1,
                          false
                        )
                      }
                      className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-indigo-400 hover:bg-indigo-50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                          {idx + 5}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            {item.name}
                          </p>
                          {item.isEstimated && (
                            <span className="text-[10px] text-slate-400">
                              Estimated price
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-extrabold text-indigo-600">
                          ${item.baseSgdPrice.toFixed(2)}
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </div>
                    </button>
                  ))}

                  <button
                    onClick={() => setShowOtherItems(false)}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to First 4 Items</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Gamified Header: Rank, Streak, D-Day & Progress Gauge */}
      <header className="rounded-b-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 px-5 pt-5 pb-6 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-xs">
              <Plane className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <h1 className="text-lg leading-none font-black tracking-tight">
                Less for More
              </h1>
              <p className="mt-1 text-[11px] font-medium text-indigo-200">
                Less in SG for More in Seoul
              </p>
            </div>
          </div>

          {/* Streak Pill & D-Day Badge */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-full bg-orange-500/90 px-2.5 py-1 text-xs font-extrabold text-white shadow-xs">
              <Flame className="h-3.5 w-3.5 fill-amber-200 text-amber-200" />
              <span>{streak}</span>
            </div>
            <button
              onClick={() => setShowGoalModal(true)}
              className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold text-amber-300 hover:bg-white/25"
            >
              <Calendar className="h-3 w-3" />
              <span>D-{daysLeft}</span>
            </button>
          </div>
        </div>

        {/* Traveler Rank & Target Seoul Area Bar */}
        <div className="mt-4 flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${currentRank.color}`}
          >
            <span>{currentRank.badge}</span>
            <span>{currentRank.title}</span>
          </span>

          <div className="flex items-center gap-1 rounded-full bg-indigo-950/40 px-3 py-1">
            <MapPin className="h-3.5 w-3.5 text-amber-300" />
            <select
              value={neighborhood}
              onChange={(e) =>
                handleNeighborhoodChange(e.target.value as Neighborhood)
              }
              className="bg-transparent text-xs font-bold text-white focus:outline-none"
            >
              {NEIGHBORHOODS.map((hood) => (
                <option key={hood} value={hood} className="text-slate-900">
                  {hood}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Savings Progress Card */}
        <div className="mt-4 rounded-2xl bg-indigo-950/35 p-3.5">
          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] font-medium text-indigo-200">
                  Seoul Trip Fund
                </p>
                <button
                  onClick={() => setShowGoalModal(true)}
                  aria-label="Edit goal"
                  className="text-indigo-300 hover:text-white"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-2xl font-black tracking-tight">
                ${savedSgd.toFixed(2)}{" "}
                <span className="text-xs font-normal text-indigo-200">
                  / ${goalSgd} SGD
                </span>
              </p>
            </div>
            <div className="text-right">
              <span className="text-sm font-black text-amber-300">
                {progressPercent}%
              </span>
              <p className="text-[10px] text-indigo-200">
                Target: ${dailyTargetSgd}/day
              </p>
            </div>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-indigo-950/70">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-300 to-emerald-400 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-5 py-5">
        {activeTab === "scan" ? (
          <div className="space-y-5">
            {/* Hidden Native Camera Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Primary Scan CTA & Separated Tax Box Buttons */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold tracking-wider text-slate-400 uppercase">
                  Pre-PayWave Check
                </span>

                {/* Separated Service Charge (10%) & GST (9%) Box Buttons */}
                <div className="flex items-center gap-1.5">
                  <label
                    className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-extrabold transition select-none ${
                      hasServiceCharge
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={hasServiceCharge}
                      onChange={handleToggleServiceCharge}
                      className="h-3.5 w-3.5 rounded accent-indigo-600"
                    />
                    <span>10% Svc</span>
                  </label>

                  <label
                    className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-extrabold transition select-none ${
                      hasGst
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={hasGst}
                      onChange={handleToggleGst}
                      className="h-3.5 w-3.5 rounded accent-indigo-600"
                    />
                    <span>9% GST</span>
                  </label>
                </div>
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="mt-3.5 flex w-full flex-col items-center justify-center gap-1.5 rounded-2xl bg-indigo-600 py-5 text-white shadow-md transition hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-amber-300" />
                    <span className="text-sm font-bold">{loadingText}</span>
                  </>
                ) : (
                  <>
                    <Camera className="h-8 w-8 text-amber-300" />
                    <span className="text-base font-black">
                      Scan Menu / Food Price
                    </span>
                    <span className="text-xs text-indigo-200">
                      Snap a dish or multi-item menu board
                    </span>
                  </>
                )}
              </button>

              {/* 1-Tap Singapore Spend Shortcuts */}
              <div className="mt-4">
                <p className="mb-2 text-xs font-bold text-slate-500">
                  Quick SG Impulse Simulators (1-Tap):
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_PRESETS.map((item) => {
                    const IconComponent = item.icon;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        disabled={loading}
                        onClick={() => {
                          setHasServiceCharge(item.svcDefault);
                          setHasGst(item.gstDefault);
                          fetchAiComparison(
                            {
                              name: item.label,
                              baseSgdPrice: item.price,
                              isEstimated: false,
                            },
                            item.svcDefault,
                            item.gstDefault,
                            neighborhood,
                            1,
                            false
                          );
                        }}
                        className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-indigo-300 hover:bg-indigo-50/50 disabled:opacity-50"
                      >
                        <IconComponent className="h-4 w-4 shrink-0 text-indigo-600" />
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            {item.label}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            ${item.price.toFixed(2)}{" "}
                            {item.svcDefault && item.gstDefault ? "++" : "nett"}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Gamified VS Battle Comparison Card */}
            {result && (
              <div className="overflow-hidden rounded-3xl border-2 border-indigo-600 bg-white shadow-xl">
                {/* VS Header Banner */}
                <div className="flex items-center justify-between bg-slate-900 px-4 py-2.5 text-white">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold">
                    <Swords className="h-4 w-4 text-amber-400" />
                    <span>OPPORTUNITY COST BATTLE</span>
                  </div>
                  <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-[11px] font-black text-slate-950">
                    {result.valueBadge}
                  </span>
                </div>

                {/* Split SG vs Seoul Comparison */}
                <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50/70">
                  {/* Left: Singapore Cost (Editable SGD) */}
                  <div className="p-4">
                    <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-extrabold text-rose-700">
                      🇸🇬 SG SPEND
                    </span>
                    <p className="mt-1.5 line-clamp-2 text-sm font-extrabold text-slate-900">
                      {result.itemName}
                    </p>
                    <div className="mt-2 flex items-center gap-1">
                      <span className="text-lg font-black text-rose-600">$</span>
                      <input
                        type="number"
                        step="0.5"
                        value={editablePrice}
                        onChange={(e) => handleManualPriceEdit(e.target.value)}
                        aria-label="Edit base SGD price"
                        className="w-20 rounded-lg border border-rose-200 bg-white px-2 py-0.5 text-base font-black text-rose-600 focus:border-rose-500 focus:outline-none"
                      />
                      <Pencil className="h-3 w-3 shrink-0 text-slate-400" />
                    </div>
                    <p className="mt-1 text-[11px] font-semibold text-slate-500">
                      Final: ${result.finalSgdPrice.toFixed(2)}{" "}
                      {formatTaxSuffix(hasServiceCharge, hasGst)}
                    </p>
                  </div>

                  {/* Right: Seoul Buying Power */}
                  <div className="bg-indigo-50/50 p-4">
                    <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-extrabold text-indigo-700">
                      🇰🇷 {neighborhood.toUpperCase()}
                    </span>
                    <p className="mt-1.5 text-xs font-bold text-slate-600">
                      Seoul Buying Power
                    </p>
                    <p className="mt-1.5 text-2xl font-black text-indigo-700">
                      ₩{result.krwAmount.toLocaleString()}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-indigo-500">
                      1 SGD = ₩{EXCHANGE_RATE}
                    </p>
                  </div>
                </div>

                {/* Seoul Experience & Feast Rewards Body */}
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      <span className="text-xs font-extrabold tracking-wide text-indigo-600 uppercase">
                        What This Unlocks
                      </span>
                    </div>

                    {/* Shuffle Another Idea Button */}
                    <button
                      type="button"
                      onClick={handleShuffleIdea}
                      disabled={refreshingIdea}
                      className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-extrabold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
                    >
                      <Dices
                        className={`h-3.5 w-3.5 ${
                          refreshingIdea ? "animate-spin" : ""
                        }`}
                      />
                      <span>{refreshingIdea ? "Matching..." : "New Idea"}</span>
                    </button>
                  </div>

                  {/* Primary Reward Card */}
                  <div
                    className={`mt-2.5 rounded-2xl border border-indigo-100 bg-indigo-50/80 p-4 transition-opacity ${
                      refreshingIdea ? "opacity-50" : "opacity-100"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-3xl">
                        {result.primaryCombo.emoji}
                      </span>
                      <div>
                        <span className="inline-block rounded-md bg-white px-2 py-0.5 text-[10px] font-extrabold text-indigo-600 shadow-2xs">
                          {result.primaryCombo.categoryTag}
                        </span>
                        <p className="mt-1 text-sm font-black text-slate-900">
                          {result.primaryCombo.title}
                        </p>
                        <p className="text-xs font-bold text-indigo-600">
                          ~₩{result.primaryCombo.estimatedKrw.toLocaleString()}{" "}
                          KRW
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">
                          {result.primaryCombo.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Alternative Option */}
                  <div
                    className={`mt-2.5 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 transition-opacity ${
                      refreshingIdea ? "opacity-50" : "opacity-100"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {result.alternativeCombo.emoji}
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        Or: {result.alternativeCombo.title}
                      </span>
                    </div>
                    <span className="shrink-0 pl-2 text-xs font-bold text-slate-500">
                      ~₩{result.alternativeCombo.estimatedKrw.toLocaleString()}
                    </span>
                  </div>

                  {/* Wingman Nudge */}
                  <p className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-900">
                    💡 {result.nudgeMessage}
                  </p>

                  {/* Decision Buttons */}
                  <div className="mt-5 space-y-2">
                    <button
                      onClick={handleSkipAndSave}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-sm font-black text-white shadow-md transition hover:bg-emerald-700 active:scale-[0.99]"
                    >
                      <CheckCircle2 className="h-5 w-5" />
                      <span>
                        Skip It! Save +${result.finalSgdPrice.toFixed(2)} &amp;
                        Unlock Stamp
                      </span>
                    </button>
                    <button
                      onClick={handleAlreadyPaid}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold text-slate-400 hover:text-rose-500"
                    >
                      <XCircle className="h-4 w-4" />
                      <span>
                        I Already Paid {streak > 0 ? "(Resets Streak)" : ""}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Dynamic 8-Category Seoul Stamp Dex */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  Seoul Experience Dex ({unlockedCategoryMap.size}/
                  {SEOUL_DEX_SLOTS.length})
                </h2>
                <p className="text-xs text-slate-500">
                  AI stamps your exact skipped rewards into each Seoul category!
                </p>
              </div>
              {unlockedRecords.length > 0 && (
                <button
                  onClick={handleResetProgress}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:text-rose-600"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {SEOUL_DEX_SLOTS.map((slot) => {
                const unlocked = unlockedCategoryMap.get(slot.id);

                return (
                  <div
                    key={slot.id}
                    className={`relative rounded-2xl border p-3.5 transition ${
                      unlocked
                        ? "border-amber-300 bg-white shadow-sm"
                        : "border-dashed border-slate-300 bg-slate-200/60 opacity-75"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-3xl ${
                          unlocked ? "" : "grayscale contrast-50"
                        }`}
                      >
                        {unlocked ? unlocked.emoji : slot.placeholderEmoji}
                      </span>
                      {unlocked ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
                          +${unlocked.savedSgd.toFixed(2)}
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5 rounded-full bg-slate-300/80 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                          <Lock className="h-2.5 w-2.5" />
                          <span>{slot.typicalKrwRange}</span>
                        </span>
                      )}
                    </div>

                    <p className="mt-2 text-[10px] font-extrabold tracking-wide text-indigo-600 uppercase">
                      {slot.categoryLabel}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs font-extrabold text-slate-900">
                      {unlocked ? unlocked.customTitle : slot.placeholderTitle}
                    </p>
                    <p className="mt-1 text-[10px] font-medium text-slate-500">
                      {unlocked
                        ? `${unlocked.neighborhood} • ₩${unlocked.krwValue.toLocaleString()}`
                        : "Skip SG spend to unlock"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="sticky bottom-0 grid grid-cols-2 border-t border-slate-200 bg-white py-2">
        <button
          onClick={() => setActiveTab("scan")}
          className={`flex flex-col items-center gap-1 py-1 text-xs font-extrabold ${
            activeTab === "scan" ? "text-indigo-600" : "text-slate-400"
          }`}
        >
          <Camera className="h-5 w-5" />
          <span>Scan &amp; Battle</span>
        </button>
        <button
          onClick={() => setActiveTab("stamps")}
          className={`flex flex-col items-center gap-1 py-1 text-xs font-extrabold ${
            activeTab === "stamps" ? "text-indigo-600" : "text-slate-400"
          }`}
        >
          <Award className="h-5 w-5" />
          <span>
            Stamp Dex ({unlockedCategoryMap.size}/{SEOUL_DEX_SLOTS.length})
          </span>
        </button>
      </nav>
    </div>
  );
}
