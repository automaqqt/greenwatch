// app/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
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
  ResponsiveContainer,
  Legend
} from 'recharts'
import { Settings, Image, LineChart as ChartIcon, Menu, X } from 'lucide-react'

// Types
interface SensorData {
  id: number
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

interface PaginatedResponse<T> {
  total: number
  data: T[]
}

const API_BASE = 'http://192.168.178.23:5000'
const API_KEY = '123abc'
const ITEMS_PER_PAGE = 20

export default function Home() {
  // Auth state
  const [auth, setAuth] = useState({
    isAuthenticated: false,
    username: '',
    password: ''
  })

  // UI state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [timeRange, setTimeRange] = useState<number>(12) // Hours
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<'pictures' | 'graphs' | 'settings'>('pictures')
  
  // Data state
  const [pictures, setPictures] = useState<Picture[]>([])
  const [sensorData, setSensorData] = useState<SensorData[]>([])
  const [selectedPicture, setSelectedPicture] = useState<Picture | null>(null)
  const [nearestSensorData, setNearestSensorData] = useState<SensorData | null>(null)
  const [loading, setLoading] = useState({
    pictures: false,
    sensorData: false
  })

  // Simple authentication
  const handleLogin = () => {
    // In a real app, you'd validate against a backend
    if (auth.username === 'admin' && auth.password === 'password') {
      setAuth(prev => ({ ...prev, isAuthenticated: true }))
    }
  }

  // Calculate time range for API requests
  const getTimeRange = useCallback(() => {
    const end = new Date(selectedDate)
    end.setHours(23, 59, 59, 999)
    const start = new Date(selectedDate)
    start.setHours(Math.max(0, end.getHours() - timeRange), 0, 0, 0)
    return {
      timestamp_after: start.toISOString(),
      timestamp_before: end.toISOString()
    }
  }, [selectedDate, timeRange])

  // Fetch data from API
  const fetchData = useCallback(async () => {
    if (!auth.isAuthenticated) return

    const { timestamp_after, timestamp_before } = getTimeRange()
    setLoading({ pictures: true, sensorData: true })

    try {
      // Fetch pictures
      const picturesUrl = new URL(`${API_BASE}/pictures`)
      picturesUrl.searchParams.append('key', API_KEY)
      picturesUrl.searchParams.append('timestamp_after', timestamp_after)
      picturesUrl.searchParams.append('timestamp_before', timestamp_before)
      picturesUrl.searchParams.append('limit', ITEMS_PER_PAGE.toString())
      picturesUrl.searchParams.append('sort', 'asc')
      
      const picturesRes = await fetch(picturesUrl.toString())
      const picturesData = await picturesRes.json()
      setPictures(picturesData.pictures)

      // Fetch sensor data
      const sensorUrl = new URL(`${API_BASE}/sensor_data`)
      sensorUrl.searchParams.append('key', API_KEY)
      sensorUrl.searchParams.append('timestamp_after', timestamp_after)
      sensorUrl.searchParams.append('timestamp_before', timestamp_before)
      sensorUrl.searchParams.append('limit', '100')
      sensorUrl.searchParams.append('sort', 'asc')
      
      const sensorRes = await fetch(sensorUrl.toString())
      const sensorData = await sensorRes.json()
      setSensorData(sensorData.sensor_data)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading({ pictures: false, sensorData: false })
    }
  }, [auth.isAuthenticated, getTimeRange])

  // Fetch data when date/time changes
  useEffect(() => {
    fetchData()
  }, [fetchData])

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

  // Custom tooltip for graphs
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border">
          <p className="text-sm font-medium text-gray-900">
            {new Date(label).toLocaleString()}
          </p>
          {payload.map((entry: any) => (
            <p
              key={entry.name}
              className="text-sm"
              style={{ color: entry.color }}
            >
              {entry.name}: {entry.value.toFixed(1)}
              {entry.name.includes('Temperature') ? '°C' : '%'}
            </p>
          ))}
        </div>
      )
    }
    return null
  }


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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="flex flex-col h-screen">
        {/* Header */}
        <header className="bg-white shadow-sm z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="mr-4 lg:hidden"
                >
                  {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </Button>
                <h1 className="text-xl font-bold text-gray-900">Plant Monitor</h1>
              </div>

              {/* Navigation */}
              <div className="hidden sm:flex space-x-4 bg-gray-50 rounded-lg p-1">
                <Button
                  variant={activeTab === 'pictures' ? 'default' : 'ghost'}
                  onClick={() => setActiveTab('pictures')}
                  className="h-9"
                >
                  <Image className="w-4 h-4 mr-2" />
                  Pictures
                </Button>
                <Button
                  variant={activeTab === 'graphs' ? 'default' : 'ghost'}
                  onClick={() => setActiveTab('graphs')}
                  className="h-9"
                >
                  <ChartIcon className="w-4 h-4 mr-2" />
                  Graphs
                </Button>
                <Button
                  variant={activeTab === 'settings' ? 'default' : 'ghost'}
                  onClick={() => setActiveTab('settings')}
                  className="h-9"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Navigation */}
        <div className="sm:hidden bg-white border-b">
          <div className="px-4 py-2 flex space-x-2 overflow-x-auto">
            <Button
              variant={activeTab === 'pictures' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('pictures')}
              className="h-9"
            >
              <Image className="w-4 h-4 mr-2" />
              Pictures
            </Button>
            <Button
              variant={activeTab === 'graphs' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('graphs')}
              className="h-9"
            >
              <ChartIcon className="w-4 h-4 mr-2" />
              Graphs
            </Button>
            <Button
              variant={activeTab === 'settings' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('settings')}
              className="h-9"
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full flex">
            {/* Sidebar */}
            <div
              className={`${
                sidebarOpen ? 'translate-x-0' : '-translate-x-full'
              } fixed lg:relative lg:translate-x-0 z-20 w-72 h-full transition-transform duration-300 ease-in-out`}
            >
              <Card className="h-full rounded-none lg:rounded-r-lg shadow-lg">
                <div className="p-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Date & Time</h3>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      className="rounded-md border"
                    />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-700 mb-4">Time Range</h4>
                    <Slider
                      value={[timeRange]}
                      onValueChange={(value) => setTimeRange(value[0])}
                      max={24}
                      step={1}
                      className="mt-2"
                    />
                    <p className="text-sm text-gray-500 text-right mt-2">
                      {timeRange} hours selected
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-w-0 overflow-y-auto">
              <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
                {/* Overlay for mobile sidebar */}
                {sidebarOpen && (
                  <div
                    className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-10"
                    onClick={() => setSidebarOpen(false)}
                  />
                )}

                {activeTab === 'pictures' && (
                  <div className="space-y-6">
                    {/* Selected picture view */}
                    {selectedPicture && (
                      <Card className="overflow-hidden shadow-lg">
                        <div className="aspect-video bg-gray-100">
                          <img
                            src={`${API_BASE}/${selectedPicture.image_path}`}
                            alt="Plant"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {nearestSensorData && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4">
                            <div className="text-center p-4 rounded-lg bg-blue-50">
                              <p className="text-sm font-medium text-blue-600">Temperature</p>
                              <p className="text-2xl font-bold text-blue-700 mt-1">
                                {nearestSensorData.temperature}°C
                              </p>
                            </div>
                            <div className="text-center p-4 rounded-lg bg-green-50">
                              <p className="text-sm font-medium text-green-600">Humidity</p>
                              <p className="text-2xl font-bold text-green-700 mt-1">
                                {nearestSensorData.humidity}%
                              </p>
                            </div>
                            <div className="text-center p-4 rounded-lg bg-amber-50">
                              <p className="text-sm font-medium text-amber-600">Soil Humidity</p>
                              <p className="text-2xl font-bold text-amber-700 mt-1">
                                {nearestSensorData.soil_humidity}%
                              </p>
                            </div>
                          </div>
                        )}
                      </Card>
                    )}

                    {/* Picture grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {pictures.map(picture => (
                        <Card
                          key={picture.id}
                          className={`overflow-hidden cursor-pointer transition-all hover:shadow-lg ${
                            selectedPicture?.id === picture.id 
                              ? 'ring-2 ring-blue-500 shadow-lg' 
                              : 'hover:ring-1 hover:ring-blue-200'
                          }`}
                          onClick={() => setSelectedPicture(picture)}
                        >
                          <div className="aspect-square bg-gray-100">
                            <img
                              src={`${API_BASE}/${picture.image_path}`}
                              alt="Plant"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="p-3">
                            <p className="text-sm text-gray-600">
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
              {/* Combined graph */}
              <Card className="p-6 shadow-md">
                <h3 className="text-xl font-semibold mb-6 text-gray-900">Environmental Data</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={sensorData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-50" />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(timestamp) => new Date(timestamp).toLocaleTimeString()}
                      className="text-sm"
                    />
                    <YAxis className="text-sm" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line
                      name="Temperature (°C)"
                      type="monotone"
                      dataKey="temperature"
                      stroke="#EF4444"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      name="Air Humidity (%)"
                      type="monotone"
                      dataKey="humidity"
                      stroke="#10B981"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      name="Soil Humidity (%)"
                      type="monotone"
                      dataKey="soil_humidity"
                      stroke="#6366F1"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
        
              {/* Data statistics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {sensorData.length > 0 && (
                  <>
                    <Card className="p-6">
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Temperature</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Average</span>
                          <span className="font-medium">
                            {(sensorData.reduce((acc, curr) => acc + curr.temperature, 0) / sensorData.length).toFixed(1)}°C
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Min</span>
                          <span className="font-medium">
                            {Math.min(...sensorData.map(d => d.temperature)).toFixed(1)}°C
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Max</span>
                          <span className="font-medium">
                            {Math.max(...sensorData.map(d => d.temperature)).toFixed(1)}°C
                          </span>
                        </div>
                      </div>
                    </Card>
        
                    <Card className="p-6">
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Air Humidity</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Average</span>
                          <span className="font-medium">
                            {(sensorData.reduce((acc, curr) => acc + curr.humidity, 0) / sensorData.length).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Min</span>
                          <span className="font-medium">
                            {Math.min(...sensorData.map(d => d.humidity)).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Max</span>
                          <span className="font-medium">
                            {Math.max(...sensorData.map(d => d.humidity)).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </Card>
        
                    <Card className="p-6">
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Soil Humidity</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Average</span>
                          <span className="font-medium">
                            {(sensorData.reduce((acc, curr) => acc + curr.soil_humidity, 0) / sensorData.length).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Min</span>
                          <span className="font-medium">
                            {Math.min(...sensorData.map(d => d.soil_humidity)).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Max</span>
                          <span className="font-medium">
                            {Math.max(...sensorData.map(d => d.soil_humidity)).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </Card>
                  </>
                )}
              </div>
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
      </div>
    </div>
  )
}