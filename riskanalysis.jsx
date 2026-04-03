import { useState, useEffect } from 'react';
import { BarChart2, AlertTriangle, Shield, TrendingDown, ChevronDown, ChevronUp, History } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { calculateRiskScore } from '@/lib/riskEngine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const CROPS = ["Rice","Wheat","Maize","Cotton","Sugarcane","Soybean","Groundnut","Mustard","Barley","Chickpea","Lentil","Sunflower"];
const HARDWARE_API = 'https://tunneling-agrisense.base44.app/predict';
const DEMO = { n: 95, p: 35, k: 30, ph: 5.2, ec: 3.8, temp: 36, moisture: 15 };

function RiskGauge({ score }) {
  const getColor = (s) => s <= 30 ? '#16a34a' : s <= 70 ? '#f59e0b' : '#ef4444';
  const color = getColor(score);
  const angle = (score / 100) * 180 - 90;

  return (
    <div className="flex flex-col items-center py-4">
      <div className="relative w-48 h-24 overflow-hidden">
        <svg viewBox="0 0 200 100" className="w-full">
          {/* Background arc */}
          <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke="#e5e7eb" strokeWidth="18" strokeLinecap="round" />
          {/* Risk arc - green */}
          <path d="M 10 100 A 90 90 0 0 1 64 27" fill="none" stroke="#16a34a" strokeWidth="18" strokeLinecap="round" />
          {/* Medium arc */}
          <path d="M 64 27 A 90 90 0 0 1 136 27" fill="none" stroke="#f59e0b" strokeWidth="18" />
          {/* High arc */}
          <path d="M 136 27 A 90 90 0 0 1 190 100" fill="none" stroke="#ef4444" strokeWidth="18" strokeLinecap="round" />
          {/* Needle */}
          <line
            x1="100" y1="100"
            x2={100 + 70 * Math.cos((angle - 90) * Math.PI / 180)}
            y2={100 + 70 * Math.sin((angle - 90) * Math.PI / 180)}
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="100" cy="100" r="6" fill={color} />
        </svg>
      </div>
      <div className="text-4xl font-bold mt-1" style={{ color }}>{score}</div>
      <div className="text-sm text-muted-foreground">/ 100</div>
    </div>
  );
}

export default function RiskAnalysis() {
  const { t } = useLanguage();
  const [form, setForm] = useState({ n: '', p: '', k: '', ph: '', ec: '', temp: '', moisture: '', cropName: 'Wheat' });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hwLoading, setHwLoading] = useState(false);
  const [hwError, setHwError] = useState('');
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser);
    base44.entities.PredictionHistory.filter({ type: 'risk_analysis' }, '-created_date', 5).then(setHistory);
  }, []);

  const loadDemo = () => setForm({ ...DEMO, cropName: 'Rice' });

  const fetchFromHardware = async () => {
    setHwLoading(true);
    setHwError('');
    try {
      const res = await fetch(HARDWARE_API, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) throw new Error('Hardware not responding');
      const data = await res.json();
      setForm(prev => ({
        ...prev,
        n: data.n ?? data.nitrogen ?? '',
        p: data.p ?? data.phosphorus ?? '',
        k: data.k ?? data.potassium ?? '',
        ph: data.ph ?? '',
        ec: data.ec ?? '',
        temp: data.temp ?? data.temperature ?? '',
        moisture: data.moisture ?? '',
      }));
    } catch (e) {
      setHwError('Could not reach hardware. Using demo values instead.');
      loadDemo();
    }
    setHwLoading(false);
  };

  const analyze = async () => {
    setLoading(true);
    const soilData = {
      n: parseFloat(form.n), p: parseFloat(form.p), k: parseFloat(form.k),
      ph: parseFloat(form.ph), ec: parseFloat(form.ec),
      temp: parseFloat(form.temp), moisture: parseFloat(form.moisture)
    };

    // Get weather data for the user's state
    let weatherData = null;
    if (user?.state) {
      const recent = await base44.entities.WeatherData.filter({ state: user.state }, '-year', 1);
      if (recent[0]) weatherData = recent[0];
    }

    const riskResult = calculateRiskScore(soilData, form.cropName, weatherData);

    // AI enhancement
    try {
      const ai = await base44.integrations.Core.InvokeLLM({
        prompt: `Crop: ${form.cropName}, State: ${user?.state || 'India'}. Risk Score: ${riskResult.riskScore}/100. 
Soil: N=${soilData.n}, P=${soilData.p}, K=${soilData.k}, pH=${soilData.ph}, EC=${soilData.ec}, Temp=${soilData.temp}°C, Moisture=${soilData.moisture}%.
Key risk factors: ${riskResult.reasons.map(r => r.factor).join(', ')}.
Provide 3 specific, actionable precautions and explain the main financial risk to the farmer.`,
        response_json_schema: {
          type: "object",
          properties: {
            ai_precautions: { type: "array", items: { type: "string" } },
            financial_risk: { type: "string" },
            expected_yield_impact: { type: "string" }
          }
        }
      });
      if (ai?.ai_precautions) {
        riskResult.aiPrecautions = ai.ai_precautions;
        riskResult.financialRisk = ai.financial_risk;
        riskResult.yieldImpact = ai.expected_yield_impact;
      }
    } catch {}

    setResults({ ...riskResult, cropName: form.cropName, soilData });

    await base44.entities.PredictionHistory.create({
      type: 'risk_analysis',
      input_data: JSON.stringify({ ...soilData, cropName: form.cropName }),
      result: JSON.stringify({ riskScore: riskResult.riskScore, riskLevel: riskResult.riskLevel, cropName: form.cropName }),
      location: user?.farm_location || '',
      pincode: user?.pincode || '',
    });

    const newHist = await base44.entities.PredictionHistory.filter({ type: 'risk_analysis' }, '-created_date', 5);
    setHistory(newHist);
    setLoading(false);
  };

  const isValid = Object.entries(form).filter(([k]) => k !== 'cropName').every(([, v]) => v !== '' && !isNaN(parseFloat(v)));

  const riskColors = { Low: 'text-green-600 bg-green-50', Medium: 'text-amber-600 bg-amber-50', High: 'text-red-500 bg-red-50', 'Very High': 'text-red-700 bg-red-100' };
  const insuranceColors = { Low: 'bg-green-50 border-green-200', Medium: 'bg-amber-50 border-amber-200', High: 'bg-red-50 border-red-200' };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart2 className="w-7 h-7 text-orange-500" />
          {t('riskAnalysis')}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Weighted Linear Combination model (GIS/Financial standard)</p>
      </div>

      {/* Input */}
      <div className="bg-white border border-border rounded-xl p-5">
        {/* Hardware fetch button */}
        <div className="flex items-center gap-3 mb-5 p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-800">📡 ESP32 / 7-in-1 Sensor</p>
            <p className="text-xs text-blue-600">Auto-reads soil parameters from connected hardware</p>
            {hwError && <p className="text-xs text-red-500 mt-1">{hwError}</p>}
          </div>
          <Button onClick={fetchFromHardware} disabled={hwLoading} className="bg-blue-600 hover:bg-blue-700 text-white text-sm shrink-0">
            {hwLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '⚡ Fetch from Hardware'}
          </Button>
        </div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{t('soilParameters')}</h2>
          <button onClick={loadDemo} className="text-xs text-primary underline">Load High-Risk Demo</button>
        </div>

        {/* Crop selector */}
        <div className="mb-4">
          <Label className="text-sm font-medium">Crop for Assessment</Label>
          <select
            value={form.cropName}
            onChange={e => setForm({ ...form, cropName: e.target.value })}
            className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
          >
            {CROPS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { key: 'n', label: t('nitrogen'), unit: 'kg/ha' },
            { key: 'p', label: t('phosphorus'), unit: 'kg/ha' },
            { key: 'k', label: t('potassium'), unit: 'kg/ha' },
            { key: 'ph', label: t('ph'), unit: '0-14' },
            { key: 'ec', label: t('ec'), unit: 'dS/m' },
            { key: 'temp', label: t('temperature'), unit: '°C' },
            { key: 'moisture', label: t('moisture'), unit: '%' },
          ].map(({ key, label, unit }) => (
            <div key={key}>
              <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
              <div className="relative mt-1">
                <Input
                  type="number" step="any"
                  value={form[key]}
                  onChange={e => setForm({ ...form, [key]: e.target.value })}
                  className="pr-10"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{unit}</span>
              </div>
            </div>
          ))}
        </div>

        <Button onClick={analyze} disabled={loading || !isValid} className="w-full mt-5 bg-orange-500 hover:bg-orange-600 text-white h-11">
          {loading ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Analyzing Risk...</>
          ) : (
            <><AlertTriangle className="w-4 h-4 mr-2" />Analyze Risk</>
          )}
        </Button>
      </div>

      {/* Results */}
      {results && (
        <div className="space-y-4">
          {/* Score Card */}
          <div className="bg-white border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">{t('riskScore')} — {results.cropName}</h2>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${riskColors[results.riskLevel]}`}>
                {results.riskLevel}
              </span>
            </div>
            <RiskGauge score={results.riskScore} />
            {results.financialRisk && (
              <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg mt-2">{results.financialRisk}</p>
            )}
            {results.yieldImpact && (
              <div className="flex items-center gap-2 mt-2 text-sm">
                <TrendingDown className="w-4 h-4 text-red-500" />
                <span className="text-muted-foreground">Yield Impact: <strong>{results.yieldImpact}</strong></span>
              </div>
            )}
          </div>

          {/* Risk Factors */}
          {results.reasons.length > 0 && (
            <div className="bg-white border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-3">{t('whyRisk')}</h3>
              <div className="space-y-2">
                {results.reasons.map((r, i) => (
                  <div key={i} className={`p-3 rounded-lg flex items-start gap-3 ${r.severity === 'high' ? 'bg-red-50' : 'bg-amber-50'}`}>
                    <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${r.severity === 'high' ? 'text-red-500' : 'text-amber-500'}`} />
                    <div>
                      <span className="text-sm font-medium">{r.factor}</span>
                      <span className="text-xs text-muted-foreground ml-2">Current: {r.value} | Ideal: {r.ideal}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Precautions */}
          <div className="bg-white border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-3">{t('howPrevent')}</h3>
            <div className="space-y-2">
              {(results.aiPrecautions || results.precautions).map((p, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-green-50 rounded-lg">
                  <span className="text-green-600 font-bold text-sm mt-0.5">{i + 1}.</span>
                  <p className="text-sm text-green-800">{p}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Insurance */}
          <div className={`border rounded-xl p-5 ${insuranceColors[results.insurance.premium]}`}>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">{t('insuranceRecommendation')}</h3>
            </div>
            <p className="font-bold text-lg text-foreground">{results.insurance.type}</p>
            <p className="text-sm text-muted-foreground mt-1">{results.insurance.description}</p>
            <p className="text-sm mt-2"><strong>Coverage:</strong> {results.insurance.coverage}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-medium bg-white/50 px-2 py-1 rounded">
                Premium Level: <strong>{results.insurance.premium}</strong>
              </span>
              <span className="text-xs font-medium bg-white/50 px-2 py-1 rounded">
                Risk: <strong>{results.riskScore}/100</strong>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <button onClick={() => setShowHistory(!showHistory)} className="w-full flex items-center justify-between p-4 hover:bg-muted/30">
            <div className="flex items-center gap-2 font-medium">
              <History className="w-4 h-4 text-muted-foreground" />
              {t('previousAnalysis')} ({history.length})
            </div>
            {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showHistory && (
            <div className="border-t p-4 space-y-2">
              {history.map(h => {
                let result = {};
                try { result = JSON.parse(h.result); } catch {}
                const level = result.riskLevel || 'N/A';
                return (
                  <div key={h.id} className="text-sm p-3 bg-muted/30 rounded-lg flex justify-between">
                    <div>
                      <span className="font-medium">{result.cropName || 'N/A'}</span>
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${riskColors[level] || 'bg-muted text-muted-foreground'}`}>
                        {level} ({result.riskScore}/100)
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(h.created_date).toLocaleDateString()}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
