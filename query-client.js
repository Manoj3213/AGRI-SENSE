// Weighted Linear Combination Risk Engine
// R = Σ(wi * fi) where wi = weight and fi = normalized factor score

const CROP_REFERENCE = {
  "Rice":       { n: 110, p: 55,  k: 45,  ph_min: 5.5, ph_max: 6.5, ec: 2.0,  temp: 30, moisture: 80 },
  "Wheat":      { n: 135, p: 70,  k: 50,  ph_min: 6.0, ph_max: 7.5, ec: 1.7,  temp: 20, moisture: 50 },
  "Maize":      { n: 135, p: 65,  k: 45,  ph_min: 5.8, ph_max: 7.0, ec: 1.7,  temp: 25, moisture: 60 },
  "Cotton":     { n: 105, p: 50,  k: 50,  ph_min: 6.0, ph_max: 8.0, ec: 5.1,  temp: 30, moisture: 50 },
  "Sugarcane":  { n: 175, p: 90,  k: 125, ph_min: 6.5, ph_max: 7.5, ec: 1.7,  temp: 26, moisture: 70 },
  "Soybean":    { n: 80,  p: 40,  k: 40,  ph_min: 6.0, ph_max: 7.0, ec: 1.5,  temp: 28, moisture: 55 },
  "Groundnut":  { n: 60,  p: 55,  k: 90,  ph_min: 5.5, ph_max: 7.0, ec: 2.0,  temp: 28, moisture: 55 },
  "Mustard":    { n: 120, p: 50,  k: 40,  ph_min: 6.0, ph_max: 7.5, ec: 2.5,  temp: 18, moisture: 40 },
  "Barley":     { n: 100, p: 45,  k: 40,  ph_min: 6.0, ph_max: 7.5, ec: 3.0,  temp: 18, moisture: 40 },
  "Chickpea":   { n: 80,  p: 60,  k: 80,  ph_min: 6.0, ph_max: 8.0, ec: 2.0,  temp: 20, moisture: 40 },
  "Lentil":     { n: 70,  p: 55,  k: 75,  ph_min: 6.0, ph_max: 8.0, ec: 2.0,  temp: 18, moisture: 40 },
  "Sunflower":  { n: 90,  p: 60,  k: 70,  ph_min: 6.0, ph_max: 7.5, ec: 2.0,  temp: 25, moisture: 45 },
  "Jute":       { n: 100, p: 50,  k: 70,  ph_min: 6.0, ph_max: 7.5, ec: 1.5,  temp: 30, moisture: 70 },
  "Coffee":     { n: 100, p: 50,  k: 80,  ph_min: 5.5, ph_max: 6.5, ec: 1.5,  temp: 22, moisture: 65 },
};

// Weights for risk factors (must sum to 1.0)
const WEIGHTS = {
  nitrogen:    0.15,
  phosphorus:  0.12,
  potassium:   0.12,
  ph:          0.20,  // pH is critical
  ec:          0.18,  // salinity is very important
  temperature: 0.13,
  moisture:    0.10,
};

export function calculateRiskScore(soilData, cropName, weatherData = null) {
  const ref = CROP_REFERENCE[cropName] || CROP_REFERENCE["Wheat"];
  const factors = [];

  // Calculate deviation factor for each parameter (0 = perfect, 1 = worst)
  const nDeviation = Math.abs(soilData.n - ref.n) / ref.n;
  const pDeviation = Math.abs(soilData.p - ref.p) / ref.p;
  const kDeviation = Math.abs(soilData.k - ref.k) / ref.k;
  
  // pH risk - critical range check
  let phRisk = 0;
  if (soilData.ph < ref.ph_min) phRisk = (ref.ph_min - soilData.ph) / ref.ph_min;
  else if (soilData.ph > ref.ph_max) phRisk = (soilData.ph - ref.ph_max) / ref.ph_max;
  
  // EC/Salinity risk
  let ecRisk = 0;
  if (soilData.ec > ref.ec) ecRisk = Math.min((soilData.ec - ref.ec) / ref.ec, 2) / 2;
  
  // Temperature risk
  const tempRisk = Math.min(Math.abs(soilData.temp - ref.temp) / ref.temp, 1);
  
  // Moisture risk
  const moistureRisk = Math.min(Math.abs(soilData.moisture - ref.moisture) / ref.moisture, 1);

  // Total weighted risk score (0-100)
  const rawScore = (
    WEIGHTS.nitrogen    * Math.min(nDeviation, 1) +
    WEIGHTS.phosphorus  * Math.min(pDeviation, 1) +
    WEIGHTS.potassium   * Math.min(kDeviation, 1) +
    WEIGHTS.ph          * phRisk +
    WEIGHTS.ec          * ecRisk +
    WEIGHTS.temperature * tempRisk +
    WEIGHTS.moisture    * moistureRisk
  ) * 100;

  const riskScore = Math.min(Math.round(rawScore), 100);

  // Identify risk reasons
  const reasons = [];
  const precautions = [];

  if (soilData.ec > ref.ec * 1.5) {
    reasons.push({ factor: "High Salinity (EC)", severity: "high", value: soilData.ec, ideal: `≤${ref.ec}` });
    precautions.push("Apply gypsum (calcium sulfate) to reduce soil salinity. Leach soil with fresh water before sowing.");
  } else if (soilData.ec > ref.ec) {
    reasons.push({ factor: "Elevated Salinity (EC)", severity: "medium", value: soilData.ec, ideal: `≤${ref.ec}` });
    precautions.push("Monitor soil salinity. Use salt-tolerant varieties if available.");
  }

  if (soilData.ph < ref.ph_min) {
    reasons.push({ factor: "Acidic Soil (Low pH)", severity: phRisk > 0.3 ? "high" : "medium", value: soilData.ph, ideal: `${ref.ph_min}–${ref.ph_max}` });
    precautions.push(`Apply agricultural lime (calcium carbonate) to raise pH to ${ref.ph_min}–${ref.ph_max}. Use acidic-tolerant varieties.`);
  } else if (soilData.ph > ref.ph_max) {
    reasons.push({ factor: "Alkaline Soil (High pH)", severity: phRisk > 0.3 ? "high" : "medium", value: soilData.ph, ideal: `${ref.ph_min}–${ref.ph_max}` });
    precautions.push(`Apply sulfur or acidifying fertilizers to lower pH. Consider gypsum application.`);
  }

  if (soilData.n < ref.n * 0.6) {
    reasons.push({ factor: "Nitrogen Deficiency", severity: "high", value: soilData.n, ideal: `~${ref.n} kg/ha` });
    precautions.push(`Apply nitrogen fertilizer (Urea/DAP). Target ${ref.n} kg/ha. Split application recommended.`);
  } else if (soilData.n > ref.n * 1.5) {
    reasons.push({ factor: "Nitrogen Excess", severity: "medium", value: soilData.n, ideal: `~${ref.n} kg/ha` });
    precautions.push("Reduce nitrogen application. Excess nitrogen causes lodging and pollution.");
  }

  if (soilData.p < ref.p * 0.6) {
    reasons.push({ factor: "Phosphorus Deficiency", severity: "medium", value: soilData.p, ideal: `~${ref.p} kg/ha` });
    precautions.push(`Apply phosphatic fertilizers (SSP/DAP). Target ${ref.p} kg/ha for good root development.`);
  }

  if (soilData.k < ref.k * 0.6) {
    reasons.push({ factor: "Potassium Deficiency", severity: "medium", value: soilData.k, ideal: `~${ref.k} kg/ha` });
    precautions.push(`Apply potassic fertilizers (MOP/Potash). Target ${ref.k} kg/ha for disease resistance.`);
  }

  if (soilData.temp > ref.temp + 8) {
    reasons.push({ factor: "High Temperature Stress", severity: "high", value: soilData.temp, ideal: `~${ref.temp}°C` });
    precautions.push("Use irrigation to reduce soil temperature. Consider shade nets for sensitive crops. Adjust sowing time.");
  } else if (soilData.temp < ref.temp - 8) {
    reasons.push({ factor: "Low Temperature Stress", severity: "medium", value: soilData.temp, ideal: `~${ref.temp}°C` });
    precautions.push("Delay sowing until temperatures warm up. Use frost protection methods if needed.");
  }

  if (soilData.moisture < ref.moisture * 0.5) {
    reasons.push({ factor: "Low Soil Moisture", severity: "high", value: soilData.moisture, ideal: `~${ref.moisture}%` });
    precautions.push("Increase irrigation frequency. Apply mulching to retain moisture. Consider drip irrigation.");
  } else if (soilData.moisture > ref.moisture * 1.5) {
    reasons.push({ factor: "Waterlogging Risk", severity: "medium", value: soilData.moisture, ideal: `~${ref.moisture}%` });
    precautions.push("Improve field drainage. Avoid excessive irrigation. Create raised beds if needed.");
  }

  // Weather risk
  if (weatherData) {
    const avgRainfall = weatherData.annual_mm || 1000;
    if (avgRainfall < 500 && ["Rice", "Sugarcane"].includes(cropName)) {
      reasons.push({ factor: "Insufficient Rainfall for Crop", severity: "high", value: `${avgRainfall}mm`, ideal: ">1000mm/year" });
      precautions.push("This crop requires heavy rainfall. Ensure adequate irrigation infrastructure.");
    }
  }

  // Insurance recommendation
  let insurance;
  if (riskScore <= 30) {
    insurance = {
      type: "Basic Revenue Protection",
      description: "Low risk detected. Basic crop revenue protection insurance is sufficient.",
      premium: "Low",
      coverage: "Covers basic yield loss from weather events"
    };
  } else if (riskScore <= 70) {
    insurance = {
      type: "Yield Protection + Weather Index",
      description: "Moderate risk. Recommend comprehensive yield protection with weather index coverage.",
      premium: "Medium",
      coverage: "Covers yield loss + weather-linked payouts for drought/flood"
    };
  } else {
    insurance = {
      type: "High Premium Catastrophic Coverage",
      description: "High risk detected. Catastrophic coverage strongly recommended to protect financial stability.",
      premium: "High",
      coverage: "Full coverage for catastrophic crop failure, soil damage, extreme weather events"
    };
  }

  return { riskScore, reasons, precautions, insurance, riskLevel: getRiskLevel(riskScore) };
}

function getRiskLevel(score) {
  if (score <= 25) return "Low";
  if (score <= 50) return "Medium";
  if (score <= 75) return "High";
  return "Very High";
}

// Random Forest-inspired scoring for crop recommendation
export function rankCrops(soilData, locationState = "") {
  const crops = Object.entries(CROP_REFERENCE);
  
  const scored = crops.map(([cropName, ref]) => {
    // Compatibility score (higher = better match)
    let score = 100;

    // N compatibility (±30% penalty)
    const nDiff = Math.abs(soilData.n - ref.n) / ref.n;
    score -= nDiff * 15;

    // P compatibility
    const pDiff = Math.abs(soilData.p - ref.p) / ref.p;
    score -= pDiff * 12;

    // K compatibility
    const kDiff = Math.abs(soilData.k - ref.k) / ref.k;
    score -= kDiff * 12;

    // pH - most critical
    if (soilData.ph < ref.ph_min || soilData.ph > ref.ph_max) {
      const phDiff = soilData.ph < ref.ph_min ? ref.ph_min - soilData.ph : soilData.ph - ref.ph_max;
      score -= phDiff * 20;
    }

    // EC/Salinity
    if (soilData.ec > ref.ec) {
      score -= ((soilData.ec - ref.ec) / ref.ec) * 18;
    }

    // Temperature
    const tempDiff = Math.abs(soilData.temp - ref.temp) / ref.temp;
    score -= tempDiff * 13;

    // Moisture
    const moistDiff = Math.abs(soilData.moisture - ref.moisture) / ref.moisture;
    score -= moistDiff * 10;

    // Add small random variation (simulating RF ensemble variance)
    score += (Math.random() - 0.5) * 2;

    return {
      crop: cropName,
      score: Math.max(0, Math.min(100, score)),
      confidence: Math.max(30, Math.min(99, Math.round(Math.max(0, score))))
    };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, 5);
}
