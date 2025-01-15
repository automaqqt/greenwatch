import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
const SettingsTab = ({ auth, API_BASE, API_KEY, setAuth }:{auth:{
    isAuthenticated: boolean,
    username: string,
    password: string
  }, API_BASE:string, API_KEY:string, setAuth:Function}) => {
    const [germDate, setGermDate] = useState('');
    
    useEffect(() => {
      const fetchPreferences = async () => {
        try {
          const url = new URL(`${API_BASE}/user/preferences`);
          url.searchParams.append('key', API_KEY);
          url.searchParams.append('username', auth.username);
          
          const response = await fetch(url.toString());
          const data = await response.json();
          
          if (data.germination_date) {
            setGermDate(data.germination_date.split('T')[0]);
          }
        } catch (error) {
          console.error('Error fetching preferences:', error);
        }
      };
      
      fetchPreferences();
    }, [API_BASE, API_KEY, auth.username]);
    
    const handleGermDateChange = async (date: string) => {
      try {
        const url = new URL(`${API_BASE}/user/preferences`);
        url.searchParams.append('key', API_KEY);
        
        await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: auth.username,
            germination_date: date ? new Date(date).toISOString() : null,
          }),
        });
        
        setGermDate(date);
      } catch (error) {
        console.error('Error updating germination date:', error);
      }
    };
    
    return (
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">Settings</h3>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500 mb-2">API Endpoint</p>
            <Input value={API_BASE} disabled />
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-2">API Key</p>
            <Input value={API_KEY} type="password" disabled />
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-2">Germination Date</p>
            <Input
              type="date"
              value={germDate}
              onChange={(e) => handleGermDateChange(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setAuth({ isAuthenticated: false, username: '', password: '' })}
          >
            Logout
          </Button>
        </div>
      </Card>
    );
  };
  
  export default SettingsTab;