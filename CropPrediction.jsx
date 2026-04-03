import { useState, useEffect } from 'react';
import { Leaf, Zap, History, ChevronDown, ChevronUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { rankCrops } from '@/lib/riskEngine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const DEMO_VALUES = { n: 85, p: 42, k: 38, ph: 6.2, ec: 1.5, temp: 28.5, moisture: 22.0 };
const HARDWARE_API = 'https://tunneling-agrisense.base44.app/predict';

const CROP_ICONS = {
  Rice: '🌾', Wheat: '🌿', Maize: '🌽', Cotton: '🪴', Sugarcane: '🎋',
  Soybean: '🫘', Groundnut: '🥜', Mustard: '🌼', Barley: '🌾', Chickpea: '🫛',
  Lentil: '🫛', Sunflower: '🌻', Jute: '🌿', Coffee: '☕'
};

export default function CropPrediction() {
  const { t } = useLanguage();
  const [form, setForm] = useState({ n: '', p: '', k: '', ph: '', ec: '', temp: '', moisture: '' });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [hwLoading, setHwLoading] = useState(false);
  const [hwError, setHwError] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser);
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const hist = await base44.entities.PredictionHistory.filter({ type: 'crop_prediction' }, '-created_date', 5);
    setHistory(hist);
  };

  const loadDemo = () => setForm(DEMO_VALUES);

  const fetchFromHardware = async () => {
    setHwLoading(true);
    setHwError('');
    try {
      const res = await fetch(HARDWARE_API, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) throw new Error('Hardware not responding');
      const data = await res.json();
      setForm({
        n: data.n ?? data.nitrogen ?? '',
        p: data.p ?? data.phosphorus ?? '',
        k: data.k ?? data.potassium ?? '',
        ph: data.ph ?? '',
        ec: data.ec ?? '',
        temp: data.temp ?? data.temperature ?? '',
        moisture: data.moisture ?? '',
      });
    } catch (e) {
      setHwError('Could not reach hardware. Using demo values instead.');
      loadDemo();
    }
    setHwLoading(false);
  };

  const predict = async () => {
    setLoading(true);
    const soilData = {
      n: parseFloat(form.n), p: parseFloat(form.p), k: parseFloat(form.k),
      ph: parseFloat(form.ph), ec: parseFloat(form.ec),
      temp: parseFloat(form.temp), moisture: parseFloat(form.moisture)
    };

    // AI-based crop ranking using Random Forest approach
    let crops = rankCrops(soilData, user?.state);

    // Enhance with AI for detailed analysis
    try {
      const aiResult = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an agricultural AI. Based on soil parameters: N=${soilData.n}kg/ha, P=${soilData.p}kg/ha, K=${soilData.k}kg/ha, pH=${soilData.ph}, EC=${soilData.ec}dS/m, Temp=${soilData.temp}°C, Moisture=${soilData.moisture}%.
Location: ${user?.state || 'India'}.
The Random Forest algorithm has ranked these crops: ${crops.map(c => c.crop).join(', ')}.
Provide sowing season info and why each is suitable.`,
        response_json_schema: {
          type: "object",
          properties: {
            crop_insights: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  crop: { type: "string" },
                  why_suitable: { type: "string" },
                  season: { type: "string" },
                  key_benefit: { type: "string" }
                }
              }
            }
          }
        }
      });
      if (aiResult?.crop_insights) {
        crops = crops.map(c => {
          const insight = aiResult.crop_insights.find(i => i.crop === c.crop);
          return { ...c, ...insight };
        });
      }
    } catch {}

    const resultData = { crops, soilData, timestamp: new Date().toISOString() };
    setResults(resultData);

    // Save to history
    await base44.entities.PredictionHistory.create({
      type: 'crop_prediction',
      input_data: JSON.stringify(soilData),
      result: JSON.stringify(resultData),
      location: user?.farm_location || '',
      pincode: user?.pincode || '',
    });

    await loadHistory();
    setLoading(false);
  };

  const isFormValid = Object.values(form).every(v => v !== '' && !isNaN(parseFloat(v)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Leaf className="w-7 h-7 text-primary" />
          {t('cropPrediction')}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Random Forest ML algorithm for top 5 crop recommendations</p>
      </div>

      {/* Soil Input */}
      <div className="bg-white border border-border rounded-xl p-5">
        {/* Hardware fetch button */}
        <div className="flex items-center gap-3 mb-5 p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-800">📡 ESP32 / 7-in-1 Sensor</p>
            <p className="text-xs text-blue-600">Reads N, P, K, pH, EC, Temp, Moisture via RS485</p>
            {hwError && <p className="text-xs text-red-500 mt-1">{hwError}</p>}
          </div>
          <Button onClick={fetchFromHardware} disabled={hwLoading} className="bg-blue-600 hover:bg-blue-700 text-white text-sm shrink-0">
            {hwLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '⚡ Fetch from Hardware'}
          </Button>
        </div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{t('soilParameters')}</h2>
          <button onClick={loadDemo} className="text-xs text-primary underline">Load Demo Values</button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { key: 'n', label: t('nitrogen'), unit: 'kg/ha', placeholder: '85', color: 'border-green-300 focus:ring-green-400' },
            { key: 'p', label: t('phosphorus'), unit: 'kg/ha', placeholder: '42', color: 'border-blue-300 focus:ring-blue-400' },
            { key: 'k', label: t('potassium'), unit: 'kg/ha', placeholder: '38', color: 'border-purple-300 focus:ring-purple-400' },
            { key: 'ph', label: t('ph'), unit: '0-14', placeholder: '6.2', color: 'border-yellow-300 focus:ring-yellow-400' },
            { key: 'ec', label: t('ec'), unit: 'dS/m', placeholder: '1.5', color: 'border-red-300 focus:ring-red-400' },
            { key: 'temp', label: t('temperature'), unit: '°C', placeholder: '28.5', color: 'border-orange-300 focus:ring-orange-400' },
            { key: 'moisture', label: t('moisture'), unit: '%', placeholder: '22', color: 'border-cyan-300 focus:ring-cyan-400' },
          ].map(({ key, label, unit, placeholder, color }) => (
            <div key={key}>
              <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
              <div className="relative mt-1">
                <Input
                  type="number"
                  step="any"
                  value={form[key]}
                  onChange={e => setForm({ ...form, [key]: e.target.value })}
                  placeholder={placeholder}
                  className={`pr-10 border ${color}`}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{unit}</span>
              </div>
            </div>
          ))}
        </div>

        <Button
          onClick={predict}
          disabled={loading || !isFormValid}
          className="w-full mt-5 bg-primary hover:bg-primary/90 text-white h-11"
        >
          {loading ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />{t('analyzing')}</>
          ) : (
            <><Zap className="w-4 h-4 mr-2" />{t('predict')}</>
          )}
        </Button>
      </div>

      {/* Results */}
      {results && (
        <div className="bg-white border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Leaf className="w-5 h-5 text-primary" />
            {t('top5Crops')}
          </h2>
          <div className="space-y-3">
            {results.crops.map((crop, i) => (
              <div key={crop.crop} className={`p-4 rounded-xl border ${i === 0 ? 'bg-green-50 border-green-300' : 'bg-muted/30 border-border'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold ${i === 0 ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                      {i + 1}
                    </span>
                    <span className="text-xl">{CROP_ICONS[crop.crop] || '🌿'}</span>
                    <span className="font-semibold">{crop.crop}</span>
                    {i === 0 && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Best Match</span>}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-primary">{crop.confidence}%</div>
                    <div className="text-xs text-muted-foreground">{t('confidence')}</div>
                  </div>
                </div>
                {/* Confidence bar */}
                <div className="w-full bg-muted rounded-full h-1.5 mb-2">
                  <div className="h-1.5 rounded-full bg-primary" style={{ width: `${crop.confidence}%` }} />
                </div>
                {crop.why_suitable && (
                  <p className="text-xs text-muted-foreground mt-1">{crop.why_suitable}</p>
                )}
                {crop.season && (
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full mt-1 inline-block">🗓️ {crop.season}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30"
          >
            <div className="flex items-center gap-2 font-medium">
              <History className="w-4 h-4 text-muted-foreground" />
              {t('previousAnalysis')} ({history.length})
            </div>
            {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showHistory && (
            <div className="border-t border-border p-4 space-y-2">
              {history.map(h => {
                let result = {};
                try { result = JSON.parse(h.result); } catch {}
                return (
                  <div key={h.id} className="text-sm p-3 bg-muted/30 rounded-lg flex justify-between items-center">
                    <div>
                      <span className="font-medium">Top Crop: {result.crops?.[0]?.crop || 'N/A'}</span>
                      <span className="text-muted-foreground ml-2">({result.crops?.[0]?.confidence}%)</span>
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
