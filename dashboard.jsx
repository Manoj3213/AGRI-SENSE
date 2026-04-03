import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Leaf, BarChart2, Cloud, ChevronRight, MapPin, Droplets, TrendingUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Dashboard() {
  const { t } = useLanguage();
  const [user, setUser] = useState(null);
  const [rainfallData, setRainfallData] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.auth.me(),
      base44.entities.PredictionHistory.list('-created_date', 5),
    ]).then(([u, hist]) => {
      setUser(u);
      setHistory(hist);
      if (u?.state) {
        base44.entities.WeatherData.filter({ state: u.state }, '-year', 10)
          .then(data => setRainfallData(data));
      }
      setLoading(false);
    });
  }, []);

  const mainCards = [
    {
      path: '/predict',
      title: t('cropPrediction'),
      description: 'AI-powered top 5 crop recommendations based on soil analysis',
      icon: Leaf,
      color: 'bg-green-500',
      bg: 'bg-green-50 border-green-200',
    },
    {
      path: '/risk',
      title: t('riskAnalysis'),
      description: 'Assess crop risks with weighted scoring and insurance guidance',
      icon: BarChart2,
      color: 'bg-orange-500',
      bg: 'bg-orange-50 border-orange-200',
    },
    {
      path: '/weather',
      title: t('weatherForecast'),
      description: 'Real-time weather forecast and seasonal rainfall analysis',
      icon: Cloud,
      color: 'bg-blue-500',
      bg: 'bg-blue-50 border-blue-200',
    },
  ];

  const chartData = rainfallData.slice(0, 8).map(d => ({
    year: d.year,
    Annual: Math.round(d.annual_mm || 0),
    Monsoon: Math.round(d.monsoon_mm || 0),
    Winter: Math.round(d.winter_mm || 0),
  })).reverse();

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-primary to-green-700 rounded-2xl p-6 text-white">
        <p className="text-green-100 text-sm">{t('welcome')}</p>
        <h1 className="text-2xl font-bold mt-1">{user?.full_name || 'Farmer'} 🌾</h1>
        {user?.farm_location && (
          <div className="flex items-center gap-1 mt-2 text-green-100 text-sm">
            <MapPin className="w-4 h-4" />
            <span>{user.farm_location}, {user.state}</span>
          </div>
        )}
        {user?.land_acres && (
          <div className="flex items-center gap-2 mt-3">
            <span className="bg-white/20 rounded-full px-3 py-1 text-sm">{user.land_acres} Acres</span>
            {user.is_harvesting && user.current_crop && (
              <span className="bg-white/20 rounded-full px-3 py-1 text-sm">🌿 {user.current_crop}</span>
            )}
          </div>
        )}
      </div>

      {!user?.profile_complete && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-amber-800 text-sm">Profile Incomplete</p>
            <p className="text-amber-600 text-xs mt-0.5">Complete your profile for better recommendations</p>
          </div>
          <Link to="/profile" className="text-sm font-medium text-amber-700 underline">Complete Now →</Link>
        </div>
      )}

      {/* Main Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {mainCards.map(({ path, title, description, icon: Icon, color, bg }) => (
          <Link
            key={path}
            to={path}
            className={`${bg} border rounded-xl p-5 hover:shadow-md transition-all group`}
          >
            <div className={`w-11 h-11 ${color} rounded-xl flex items-center justify-center mb-3`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
            <div className="flex items-center gap-1 mt-3 text-sm font-medium text-primary">
              Open <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        ))}
      </div>

      {/* Rainfall Chart */}
      {chartData.length > 0 && (
        <div className="bg-white border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Droplets className="w-5 h-5 text-blue-500" />
            <h2 className="font-semibold">{t('rainfallHistory')} — {user?.state}</h2>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `${v} mm`} />
              <Legend />
              <Bar dataKey="Annual" fill="#16a34a" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Monsoon" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Winter" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Previous Analysis */}
      {history.length > 0 && (
        <div className="bg-white border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">{t('previousAnalysis')}</h2>
          </div>
          <div className="space-y-2">
            {history.map(h => {
              let result = {};
              try { result = JSON.parse(h.result); } catch {}
              return (
                <div key={h.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm">
                  <div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mr-2 ${h.type === 'crop_prediction' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {h.type === 'crop_prediction' ? '🌱 Prediction' : '⚠️ Risk'}
                    </span>
                    <span className="text-muted-foreground">
                      {h.type === 'crop_prediction' ? `Top: ${result.crops?.[0]?.crop || 'N/A'}` : `Risk: ${result.riskScore || 'N/A'}/100`}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(h.created_date).toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
