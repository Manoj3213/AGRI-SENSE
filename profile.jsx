import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { User, MapPin, Phone, Layers, Sprout, Bell, Mic, MapPinned, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab",
  "Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh",
  "Uttarakhand","West Bengal"
];

export default function Profile() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [permissions, setPermissions] = useState({ location: false, notification: false, mic: false });
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setForm({
        phone: u.phone || '',
        farm_location: u.farm_location || '',
        pincode: u.pincode || '',
        state: u.state || '',
        land_acres: u.land_acres || '',
        current_crop: u.current_crop || '',
        is_harvesting: u.is_harvesting || false,
      });
      if (u.profile_complete) setPermissionsGranted(true);
    });
  }, []);

  const requestPermissions = async () => {
    let loc = false, notif = false, mic = false;
    try {
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
      loc = true;
    } catch {}
    try {
      const n = await Notification.requestPermission();
      notif = n === 'granted';
    } catch {}
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      mic = true;
    } catch {}
    setPermissions({ location: loc, notification: notif, mic });
    setPermissionsGranted(true);
  };

  const handleSave = async () => {
    setSaving(true);
    await base44.auth.updateMe({ ...form, profile_complete: true });
    setSaving(false);
    setSaved(true);
    setTimeout(() => { setSaved(false); navigate('/'); }, 1500);
  };

  if (!user) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-lg mx-auto">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
          <User className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">{t('completeProfile')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('profileSubtitle')}</p>
      </div>

      {/* Permissions Card */}
      {!permissionsGranted && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-amber-800 flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4" />
            {t('permissionsRequired')}
          </h3>
          <div className="space-y-2 mb-4">
            {[
              { icon: MapPinned, label: t('locationPermission'), key: 'location' },
              { icon: Bell, label: t('notificationPermission'), key: 'notification' },
              { icon: Mic, label: t('micPermission'), key: 'mic' },
            ].map(({ icon: Icon, label, key }) => (
              <div key={key} className="flex items-center gap-2 text-sm text-amber-700">
                <Icon className="w-4 h-4" />
                <span>{label}</span>
                {permissions[key] && <CheckCircle className="w-4 h-4 text-green-600 ml-auto" />}
              </div>
            ))}
          </div>
          <Button onClick={requestPermissions} className="w-full bg-amber-500 hover:bg-amber-600 text-white">
            {t('allowPermissions')}
          </Button>
        </div>
      )}

      <div className="bg-white border border-border rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">{t('fullName')}</Label>
            <Input value={user.full_name || ''} disabled className="mt-1 bg-muted" />
          </div>
          <div>
            <Label className="text-sm font-medium">{t('phoneNumber')}</Label>
            <Input
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              placeholder="+91 XXXXX XXXXX"
              className="mt-1"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">{t('state')}</Label>
            <select
              value={form.state}
              onChange={e => setForm({ ...form, state: e.target.value })}
              className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
            >
              <option value="">Select State</option>
              {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-sm font-medium">{t('pincode')}</Label>
            <Input
              value={form.pincode}
              onChange={e => setForm({ ...form, pincode: e.target.value })}
              placeholder="500001"
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label className="text-sm font-medium">{t('farmLocation')}</Label>
          <Input
            value={form.farm_location}
            onChange={e => setForm({ ...form, farm_location: e.target.value })}
            placeholder="District / Village"
            className="mt-1"
          />
        </div>

        <div>
          <Label className="text-sm font-medium">{t('landAcres')}</Label>
          <Input
            type="number"
            value={form.land_acres}
            onChange={e => setForm({ ...form, land_acres: e.target.value })}
            placeholder="5"
            className="mt-1"
          />
        </div>

        <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
          <input
            type="checkbox"
            id="harvesting"
            checked={form.is_harvesting}
            onChange={e => setForm({ ...form, is_harvesting: e.target.checked })}
            className="w-4 h-4 accent-primary"
          />
          <Label htmlFor="harvesting" className="cursor-pointer text-sm font-medium">{t('isHarvesting')}</Label>
        </div>

        {form.is_harvesting && (
          <div>
            <Label className="text-sm font-medium">{t('currentCrop')}</Label>
            <Input
              value={form.current_crop}
              onChange={e => setForm({ ...form, current_crop: e.target.value })}
              placeholder="e.g. Rice, Wheat..."
              className="mt-1"
            />
          </div>
        )}

        <Button
          onClick={handleSave}
          disabled={saving || !form.state || !form.pincode}
          className="w-full bg-primary hover:bg-primary/90 text-white"
        >
          {saved ? <><CheckCircle className="w-4 h-4 mr-2" /> Saved!</> : saving ? 'Saving...' : t('saveProfile')}
        </Button>
      </div>
    </div>
  );
}
