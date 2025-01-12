// app/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Slider } from '@/components/ui/slider'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { Settings, Image, LineChart as ChartIcon } from 'lucide-react'

// Types
interface SensorData {
  timestamp: string
  temperature: number
  humidity: number
  soil_humidity: number
}

interface Picture {
  id: number
  timestamp: string
  image_path: string
}

interface AuthState {
  isAuthenticated: boolean
  username: string
  password: string
}

const API_BASE = 'http://192.168.178.98:5000'
const API_KEY = '123abc'

export default function Home() {
  // Auth state
  const [auth, setAuth] = useState<AuthState>({
    isAuthenticated: false,
    username: '',
    password: ''
  })

  // App state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [timeRange, setTimeRange] = useState<number>(12) // Hours
  const [pictures, setPictures] = useState<Picture[]>([])
  const [sensorData, setSensorData] = useState<SensorData[]>([])
  const [selectedPicture, setSelectedPicture] = useState<Picture | null>(null)
  const [nearestSensorData, setNearestSensorData] = useState<SensorData | null>(null)
  const [activeTab, setActiveTab] = useState<'pictures' | 'graphs' | 'settings'>('pictures')

  // Simple authentication
  const handleLogin = () => {
    // In a real app, you'd validate against a backend
    if (auth.username === 'admin' && auth.password === 'password') {
      setAuth(prev => ({ ...prev, isAuthenticated: true }))
    }
  }

  // Fetch data when date/time changes
  useEffect(() => {
    if (!auth.isAuthenticated) return

    const fetchData = async () => {
      try {
        // Fetch pictures
        const picturesRes = await fetch(`${API_BASE}/pictures?key=${API_KEY}`)
        const picturesData = await picturesRes.json()
        setPictures(picturesData.pictures)

        // Fetch sensor data
        const sensorRes = await fetch(`${API_BASE}/sensor_data?key=${API_KEY}`)
        const sensorData = await sensorRes.json()
        setSensorData(sensorData.sensor_data)
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }

    fetchData()
  }, [auth.isAuthenticated, selectedDate, timeRange])

  // Find nearest sensor data when picture selected
  useEffect(() => {
    if (selectedPicture && sensorData.length > 0) {
      const selectedTime = new Date(selectedPicture.timestamp).getTime()
      const nearest = sensorData.reduce((prev, curr) => {
        const prevDiff = Math.abs(new Date(prev.timestamp).getTime() - selectedTime)
        const currDiff = Math.abs(new Date(curr.timestamp).getTime() - selectedTime)
        return currDiff < prevDiff ? curr : prev
      })
      setNearestSensorData(nearest)
    }
  }, [selectedPicture, sensorData])

  if (!auth.isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="w-96 p-6 space-y-4">
          <h2 className="text-2xl font-bold text-center">Plant Monitor Login</h2>
          <Input
            placeholder="Username"
            value={auth.username}
            onChange={e => setAuth(prev => ({ ...prev, username: e.target.value }))}
          />
          <Input
            type="password"
            placeholder="Password"
            value={auth.password}
            onChange={e => setAuth(prev => ({ ...prev, password: e.target.value }))}
          />
          <Button className="w-full" onClick={handleLogin}>Login</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Navigation */}
        <div className="flex space-x-4 mb-6">
          <Button
            variant={activeTab === 'pictures' ? 'default' : 'outline'}
            onClick={() => setActiveTab('pictures')}
          >
            <Image className="w-4 h-4 mr-2" />
            Pictures
          </Button>
          <Button
            variant={activeTab === 'graphs' ? 'default' : 'outline'}
            onClick={() => setActiveTab('graphs')}
          >
            <ChartIcon className="w-4 h-4 mr-2" />
            Graphs
          </Button>
          <Button
            variant={activeTab === 'settings' ? 'default' : 'outline'}
            onClick={() => setActiveTab('settings')}
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>

        {/* Main content */}
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar */}
          <Card className="col-span-3 p-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="mb-4"
            />
            <div className="space-y-2">
              <p className="text-sm text-gray-500">Time Range (hours)</p>
              <Slider
                value={[timeRange]}
                onValueChange={(value) => setTimeRange(value[0])}
                max={24}
                step={1}
              />
              <p className="text-sm text-right">{timeRange}h</p>
            </div>
          </Card>

          {/* Main content area */}
          <div className="col-span-9">
            {activeTab === 'pictures' && (
              <div className="space-y-6">
                {/* Selected picture view */}
                {selectedPicture && (
                  <Card className="p-4">
                    <div className="aspect-video bg-gray-200 rounded-lg mb-4">
                      <img
                        src={`${API_BASE}/${selectedPicture.image_path}`}
                        alt="Plant"
                        className="w-full h-full object-cover rounded-lg"
                      />
                    </div>
                    {nearestSensorData && (
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-sm text-gray-500">Temperature</p>
                          <p className="text-xl font-bold">{nearestSensorData.temperature}°C</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Humidity</p>
                          <p className="text-xl font-bold">{nearestSensorData.humidity}%</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Soil Humidity</p>
                          <p className="text-xl font-bold">{nearestSensorData.soil_humidity}%</p>
                        </div>
                      </div>
                    )}
                  </Card>
                )}

                {/* Picture grid */}
                <div className="grid grid-cols-4 gap-4">
                  {pictures.map(picture => (
                    <Card
                      key={picture.id}
                      className={`cursor-pointer transition-all ${
                        selectedPicture?.id === picture.id ? 'ring-2 ring-blue-500' : ''
                      }`}
                      onClick={() => setSelectedPicture(picture)}
                    >
                      <div className="aspect-square bg-gray-200 rounded-t-lg">
                        <img
                          src={`${API_BASE}/${picture.image_path}`}
                          alt="Plant"
                          className="w-full h-full object-cover rounded-t-lg"
                        />
                      </div>
                      <div className="p-2">
                        <p className="text-sm text-gray-500">
                          {new Date(picture.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'graphs' && (
              <div className="space-y-6">
                {/* Temperature graph */}
                <Card className="p-4">
                  <h3 className="text-lg font-semibold mb-4">Temperature</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={sensorData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={(timestamp) => new Date(timestamp).toLocaleTimeString()}
                      />
                      <YAxis />
                      <Tooltip
                        labelFormatter={(timestamp) => new Date(timestamp).toLocaleString()}
                      />
                      <Line type="monotone" dataKey="temperature" stroke="#8884d8" />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>

                {/* Humidity graph */}
                <Card className="p-4">
                  <h3 className="text-lg font-semibold mb-4">Humidity</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={sensorData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={(timestamp) => new Date(timestamp).toLocaleTimeString()}
                      />
                      <YAxis />
                      <Tooltip
                        labelFormatter={(timestamp) => new Date(timestamp).toLocaleString()}
                      />
                      <Line type="monotone" dataKey="humidity" stroke="#82ca9d" />
                      <Line type="monotone" dataKey="soil_humidity" stroke="#ffc658" />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            )}

            {activeTab === 'settings' && (
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
                  <Button
                    variant="outline"
                    onClick={() => setAuth({ isAuthenticated: false, username: '', password: '' })}
                  >
                    Logout
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}