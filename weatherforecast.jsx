import { useState, useEffect } from 'react';
import { Cloud, Droplets, Thermometer, Wind, MapPin, Sun, CloudRain, CloudSnow } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';

export default function WeatherForecast() {
  const { t } = useLanguage();
  const [user, setUser] = useState(null);
  const [weather, setWeather] = useState(null);
  const [rainfall, setRainfall] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pincode, setPincode] = useState('');

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setPincode(u?.pincode || '');
      if (u?.state) loadRainfallData(u.state);
      // Auto-fetch weather using pincode, then location, then state
      const locationQuery = u?.pincode || u?.farm_location || u?.state;
      if (locationQuery) fetchWeather(locationQuery);
    });
  }, []);

  const loadRainfallData = async (state) => {
    const data = await base44.entities.WeatherData.filter({ state }, '-year', 20);
    setRainfall(data.reverse());
  };

  const fetchWeather = async (location) => {
    setLoading(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Provide current weather forecast and 5-day outlook for ${location}, India. Include temperature, humidity, rainfall probability, wind speed, and farming advice. Use real-time data.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            location: { type: "string" },
            current: {
              type: "object",
              properties: {
                temp_c: { type: "number" },
                humidity: { type: "number" },
                condition: { type: "string" },
                wind_kmh: { type: "number" },
                rain_chance: { type: "number" },
                uv_index: { type: "number" },
                feels_like: { type: "number" }
              }
            },
            forecast: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  day: { type: "string" },
                  max_temp: { type: "number" },
                  min_temp: { type: "number" },
                  rain_chance: { type: "number" },
                  condition: { type: "string" }
                }
              }
            },
            farming_advisory: { type: "string" },
            season: { type: "string" },
            next_rain: { type: "string" }
          }
        }
      });
      setWeather(result);
    } catch {}
    setLoading(false);
  };

  const getConditionIcon = (cond = '') => {
    const c = cond.toLowerCase();
    if (c.includes('rain') || c.includes('shower')) return CloudRain;
    if (c.includes('cloud') || c.includes('overcast')) return Cloud;
    if (c.includes('snow')) return CloudSnow;
    return Sun;
  };

  const rainfallChartData = rainfall.map(d => ({
    year: d.year,
    Annual: Math.round(d.annual_mm || 0),
    Monsoon: Math.round(d.monsoon_mm || 0),
    'Post-Monsoon': Math.round(d.post_monsoon_mm || 0),
    Winter: Math.round(d.winter_mm || 0),
    Summer: Math.round(d.summer_mm || 0),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Cloud className="w-7 h-7 text-blue-500" />
          {t('weatherForecastTitle')}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Real-time weather + 20-year historical rainfall analysis</p>
      </div>

      {/* Location Search */}
      <div className="bg-white border border-border rounded-xl p-4 flex gap-3">
        <div className="flex-1 relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={pincode}
            onChange={e => setPincode(e.target.value)}
            placeholder="Enter pincode or location..."
            className="w-full pl-9 pr-4 py-2 border border-input rounded-lg text-sm bg-background"
          />
        </div>
        <Button onClick={() => fetchWeather(pincode || user?.farm_location)} disabled={loading} className="bg-blue-500 hover:bg-blue-600 text-white">
          {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : t('getWeather')}
        </Button>
      </div>

      {/* Current Weather */}
      {weather && (
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-2 mb-2 text-blue-100 text-sm">
            <MapPin className="w-4 h-4" />
            <span>{weather.location}</span>
            {weather.season && <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full">{weather.season}</span>}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-6xl font-bold">{weather.current?.temp_c}°C</div>
              <div className="text-blue-100 mt-1">{weather.current?.condition}</div>
              <div className="text-blue-100 text-sm">Feels like {weather.current?.feels_like}°C</div>
            </div>
            <div className="space-y-2 text-right">
              <div className="flex items-center justify-end gap-2 text-sm">
                <Droplets className="w-4 h-4" />
                <span>{weather.current?.humidity}% Humidity</span>
              </div>
              <div className="flex items-center justify-end gap-2 text-sm">
                <Wind className="w-4 h-4" />
                <span>{weather.current?.wind_kmh} km/h</span>
              </div>
              <div className="flex items-center justify-end gap-2 text-sm">
                <CloudRain className="w-4 h-4" />
                <span>{weather.current?.rain_chance}% Rain</span>
              </div>
              <div className="flex items-center justify-end gap-2 text-sm">
                <Sun className="w-4 h-4" />
                <span>UV {weather.current?.uv_index}</span>
              </div>
            </div>
          </div>

          {weather.farming_advisory && (
            <div className="mt-4 bg-white/20 rounded-xl p-3 text-sm">
              🌾 <strong>Farming Advisory:</strong> {weather.farming_advisory}
            </div>
          )}
        </div>
      )}

      {/* 5-Day Forecast */}
      {weather?.forecast && (
        <div className="bg-white border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">5-Day Forecast</h3>
          <div className="grid grid-cols-5 gap-2">
            {weather.forecast.slice(0, 5).map((day, i) => {
              const Icon = getConditionIcon(day.condition);
              return (
                <div key={i} className={`text-center p-3 rounded-xl ${i === 0 ? 'bg-blue-50 border border-blue-200' : 'bg-muted/30'}`}>
                  <div className="text-xs font-medium text-muted-foreground">{day.day}</div>
                  <Icon className="w-6 h-6 mx-auto my-2 text-blue-500" />
                  <div className="text-sm font-bold">{day.max_temp}°</div>
                  <div className="text-xs text-muted-foreground">{day.min_temp}°</div>
                  <div className="text-xs text-blue-600 mt-1">{day.rain_chance}%</div>
                </div>
              );
            })}
          </div>
          {weather.next_rain && (
            <p className="text-sm text-muted-foreground mt-3 flex items-center gap-1">
              <CloudRain className="w-4 h-4 text-blue-500" />
              Next rain expected: <strong className="ml-1">{weather.next_rain}</strong>
            </p>
          )}
        </div>
      )}

      {/* Historical Rainfall */}
      {rainfallChartData.length > 0 && (
        <div className="bg-white border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">{t('rainfallHistory')} — {user?.state}</h3>

          {/* Annual Trend */}
          <p className="text-xs text-muted-foreground mb-3">Annual Rainfall Trend (mm)</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={rainfallChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="year" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => `${v} mm`} />
              <Line type="monotone" dataKey="Annual" stroke="#16a34a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>

          {/* Seasonal Breakdown */}
          <p className="text-xs text-muted-foreground mt-5 mb-3">Seasonal Rainfall Breakdown (mm)</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={rainfallChartData.slice(-10)} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="year" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => `${v} mm`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Monsoon" fill="#3b82f6" stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Post-Monsoon" fill="#8b5cf6" stackId="a" />
              <Bar dataKey="Winter" fill="#f59e0b" stackId="a" />
              <Bar dataKey="Summer" fill="#ef4444" stackId="a" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          {/* Stats */}
          {rainfallChartData.length > 0 && (
            <div className="grid grid-cols-4 gap-3 mt-4">
              {['Annual', 'Monsoon', 'Winter', 'Summer'].map(key => {
                const vals = rainfallChartData.map(d => d[key]).filter(Boolean);
                const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
                return (
                  <div key={key} className="text-center p-2 bg-muted/30 rounded-lg">
                    <div className="text-sm font-bold text-primary">{avg}</div>
                    <div className="text-xs text-muted-foreground">{key} avg (mm)</div>
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
