// app/page.tsx
'use client'
import { useState, useEffect, useCallback, useRef, KeyboardEvent } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Slider } from '@/components/ui/slider'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi
} from "@/components/ui/carousel"
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
import { Settings, Image, LineChart as ChartIcon, Menu, X, Video } from 'lucide-react'
import TimelapseTab from '@/components/tabs/timelapse'
import SettingsTab from '@/components/tabs/settings'
import VPDCalculator from '@/components/ui/vpd'

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


const API_KEY = '123abc'
const API_BASE = 'https://farm.vidsoft.net/api'
const ITEMS_PER_PAGE = 6*24

const CURRENT_IMG : Picture = {
  id: 0,
  timestamp: 'current',
  image_path: '/uploads/current.jpg'}

export default function Home() {
  // Auth state
  const [auth, setAuth] = useState({
    isAuthenticated: false,
    username: '',
    password: '',
    apiKey: ''
  })

  // UI state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [timeRange, setTimeRange] = useState<number>(12) // Hours
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<'pictures' | 'graphs' | 'settings' | 'timelapse'>('pictures')
  
  // Data state
  const [pictures, setPictures] = useState<Picture[]>([])
  const [sensorData, setSensorData] = useState<SensorData[]>([])
  const [selectedPicture, setSelectedPicture] = useState<Picture | null>(CURRENT_IMG)
  const [nearestSensorData, setNearestSensorData] = useState<SensorData | null>(null)
  const [carouselApi, setCarouselApi] = useState<CarouselApi>()
  const [currentTime, setCurrentTime] = useState(Date.now());
  const itemRefs = useRef<HTMLDivElement[]>([]);

  // Simple authentication
  const handleLogin = () => {
    // In a real app, you'd validate against a backend
    if (auth.username === 'admin' && auth.password === 'password') {
      setAuth(prev => ({ ...prev, isAuthenticated: true }))
    }
  }

const getTimeRange = useCallback(() => {
  const end = new Date(selectedDate);
  end.setHours(23, 59, 59, 999); // End of the selected date
  end.setHours(end.getHours() + 1);

  let start = new Date(selectedDate);
  start.setHours(0, 0, 0, 0); // Start of the selected date
  start.setHours(start.getHours() + 1);
  //console.log(start.toDateString())
  // add timerange if selecteddate is not today
  if (start.toDateString() === new Date().toDateString()) {
    start = new Date();
    start.setHours(start.getHours() - timeRange);
  }
  

  // Ensure the adjusted start doesn't go before the start of the day
  //const finalStart = adjustedStart < start ? start : adjustedStart;

  return {
    timestamp_after: start.toISOString(),
    timestamp_before: end.toISOString(),
  };
}, [selectedDate, timeRange]);

const calculateAbsoluteHumidity = (temperature: number, relativeHumidity: number): number => {
  // Convert temperature to Kelvin
  const T = temperature + 273.15;
  
  // Calculate saturation vapor pressure (Magnus formula)
  // Result in hPa (hectopascals)
  const saturationVaporPressure = 6.1078 * Math.exp((17.27 * temperature) / (temperature + 237.3));
  
  // Calculate actual vapor pressure in hPa
  const actualVaporPressure = (relativeHumidity / 100) * saturationVaporPressure;
  
  // Calculate absolute humidity in g/m³
  // The constant 2.16679 is a combination of:
  // - Converting hPa to Pa (*100)
  // - The molar mass of water (18.01528 g/mol)
  // - The universal gas constant (8.31447 J/(mol·K))
  const absoluteHumidity = (2.16679 * actualVaporPressure * 100) / T;
  
  // Round to 2 decimal places for practical use
  return Number(absoluteHumidity.toFixed(2));
};
  // Fetch data from API
  const fetchData = useCallback(async () => {
    if (!auth.isAuthenticated) return

    const { timestamp_after, timestamp_before } = getTimeRange()

    try {
      // Fetch pictures
      const picturesUrl = new URL(`${API_BASE}/pictures`)
      picturesUrl.searchParams.append('key', API_KEY)
      picturesUrl.searchParams.append('timestamp_after', timestamp_after)
      picturesUrl.searchParams.append('timestamp_before', timestamp_before)
      picturesUrl.searchParams.append('limit', ITEMS_PER_PAGE.toString())
      picturesUrl.searchParams.append('sort', 'desc')
      
      const picturesRes = await fetch(picturesUrl.toString())
      const picturesData = await picturesRes.json()
      setPictures(picturesData.pictures)
      setSelectedPicture(picturesData.pictures[0])

      // Fetch sensor data
      const sensorUrl = new URL(`${API_BASE}/sensor_data`)
      sensorUrl.searchParams.append('key', API_KEY)
      sensorUrl.searchParams.append('timestamp_after', timestamp_after)
      sensorUrl.searchParams.append('timestamp_before', timestamp_before)
      sensorUrl.searchParams.append('limit', '3000')
      sensorUrl.searchParams.append('sort', 'asc')
      
      const sensorRes = await fetch(sensorUrl.toString())
      const sensorData = await sensorRes.json()
      const processedSensorData = sensorData.sensor_data.map((data: { temperature: number; humidity: number }) => ({
        ...data,
        absolute_humidity: calculateAbsoluteHumidity(data.temperature, data.humidity),
      }));
      setSensorData(processedSensorData)
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }, [auth.isAuthenticated, getTimeRange])

  // Fetch data when date/time changes
  useEffect(() => {
    fetchData();
    // Set up the interval to refresh data
    const interval = setInterval(() => {
      fetchData();
    }, 60000*1); // 5 seconds

    // Clean up the interval on unmount
    return () => clearInterval(interval);
  }, [fetchData])

  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, pictures.length + 1);
  }, [pictures]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTime(Date.now());
    }, 120000); // refresh every 2 minutes
  
    return () => clearInterval(intervalId);
  }, []);

  // Find nearest sensor data when picture selected
  useEffect(() => {
    if (selectedPicture && sensorData.length > 0) {

      let selectedTime = new Date(selectedPicture.timestamp).getTime()
      if (selectedPicture.id === 0) {
        selectedTime = new Date().getTime()
      }
      const nearest = sensorData.reduce((prev, curr) => {
        const prevDiff = Math.abs(new Date(prev.timestamp).getTime() - selectedTime)
        const currDiff = Math.abs(new Date(curr.timestamp).getTime() - selectedTime)
        return currDiff < prevDiff ? curr : prev
      })
      setNearestSensorData(nearest)
    }
  }, [selectedPicture, sensorData])

  useEffect(() => {
    if (!carouselApi) {
      return
    }
    
    carouselApi.on("select", () => {
      //console.log(pictures)
      
      setSelectedPicture(pictures[carouselApi.selectedScrollSnap()])
    })
  }, [carouselApi, pictures])

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, index: number) => {
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        if (index < itemRefs.current.length - 1) {
          //setCurrentFocus(index + 1);
          itemRefs.current[index + 1].focus();
          carouselApi?.scrollNext();
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (index > 0) {
          //setCurrentFocus(index - 1);
          itemRefs.current[index - 1].focus();
          carouselApi?.scrollPrev();
        }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (index === 0) {
          setSelectedPicture(CURRENT_IMG);
        } else {
          setSelectedPicture(pictures[index - 1]);
        }
        break;
      default:
        break;
    }
  };

  // Custom tooltip for graphs
  // eslint-disable-next-line
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border">
          <p className="text-sm font-medium text-gray-900">
            {new Date(label).toLocaleString()}
          </p>
          
          {// eslint-disable-next-line
           payload.map((entry: any) => (
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
                  variant={activeTab === 'timelapse' ? 'default' : 'ghost'}
                  onClick={() => setActiveTab('timelapse')}
                  className="h-9"
                >
                  <Video className="w-4 h-4 mr-2" />
                  Timelapse
                </Button>
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
                      min={1}
                      step={1}
                      className="mt-2"
                      disabled={(new Date(selectedDate).toDateString() !== new Date().toDateString())}
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

                {activeTab === 'timelapse' && (
                  <TimelapseTab
                    auth={auth}
                    API_BASE={API_BASE}
                    API_KEY={API_KEY}
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
                            style={{ transform: 'rotate(180deg)' }}
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

                    {/* Picture carousel */}
                    <div className="flex justify-center">
                    <Carousel className="max-w-60 sm:max-w-lg md:max-w-xl lg:w-full" setApi={setCarouselApi} opts={{
                                                    align: "start",
                                                    dragFree: true,
                                                  }}>
                      <CarouselContent>
                        <CarouselItem key={12345} className="basis-1/2 sm:basis-1/3  lg:basis-1/5">
                        <Card
                          key={12345}
                          ref={(el) => {
                            if (el) {
                              itemRefs.current[0] = el;
                            }
                          }}
                          className={`overflow-hidden cursor-pointer transition-all hover:shadow-lg m-1 ${
                            selectedPicture?.id === CURRENT_IMG.id 
                              ? 'ring-2 ring-blue-500 shadow-lg' 
                              : 'hover:ring-1 hover:ring-blue-200'
                          }`}
                          onClick={() => setSelectedPicture(CURRENT_IMG)}
                          onKeyDown={(e) => handleKeyDown(e, -1)}
                        >
                          <div className="aspect-square bg-gray-100">
                            <img
                              src={`${API_BASE}/${CURRENT_IMG.image_path}?t=${currentTime}`}
                              alt="Plant"
                              className="w-full h-full object-cover"
                              style={{ transform: 'rotate(180deg)' }}
                            />
                          </div>
                          <div className="p-2 pl-4">
                            <p className="text-sm text-gray-600">
                              {new Date().toLocaleTimeString(navigator.language, {
                                                                  hour: '2-digit',
                                                                  minute:'2-digit'
                                                                })}
                            </p>
                          </div>
                        </Card>
                        </CarouselItem>
                        {pictures.map((picture, index) => (
                          <CarouselItem key={picture.id} className="basis-1/2 sm:basis-1/3  lg:basis-1/5">
                            <Card
                            ref={(el) => {
                              if (el) {
                                itemRefs.current[index] = el;
                              }
                            }}
                          key={picture.id}
                          className={`overflow-hidden cursor-pointer transition-all hover:shadow-lg m-1 ${
                            selectedPicture?.id === picture.id 
                              ? 'ring-2 ring-blue-500 shadow-lg' 
                              : 'hover:ring-1 hover:ring-blue-200'
                          }`}
                          onClick={() => setSelectedPicture(picture)}
                          onKeyDown={(e) => handleKeyDown(e, index)}
                        >
                          <div className="aspect-square bg-gray-100">
                            <img
                              src={`${API_BASE}/${picture.image_path}`}
                              alt="Plant"
                              className="w-full h-full object-cover"
                              style={{ transform: 'rotate(180deg)' }}
                            />
                          </div>
                          <div className="p-2 pl-4">
                            <p className="text-sm text-gray-600">
                              {new Date(picture.timestamp).toLocaleTimeString(navigator.language, {
                                                                  hour: '2-digit',
                                                                  minute:'2-digit'
                                                                })}
                            </p>
                          </div>
                        </Card>
                          </CarouselItem>
                        
                      ))}
                      </CarouselContent>
                      <CarouselPrevious />
                      <CarouselNext />
                    </Carousel>
                    
                      
                    </div>
                    </div>
                )}


            {activeTab === 'graphs' && (
              <div className="space-y-6">
              {/* Combined graph */}
              <Card className="p-6 shadow-md">
                <h3 className="text-xl font-semibold mb-6 text-gray-900">Environmental Data</h3>
                <ResponsiveContainer width="100%" height={400} style={{ marginLeft: '-2rem' }}>
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
                    <Line
                      name="Absolute Humidity (g/m³)"
                      type="monotone"
                      dataKey="absolute_humidity"
                      stroke="#FF8800"
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
                    <Card className="p-6">
                      <h4 className="text-sm font-medium text-gray-500 mb-2">VPD</h4>
                      <div className="space-y-2">
                        <VPDCalculator API_KEY={API_KEY} />  
                      </div>
                    </Card>
                  </>
                )}
              </div>
            </div>
            )}

            {activeTab === 'settings' && (
              <SettingsTab auth={auth} API_BASE={API_BASE} API_KEY={API_KEY} setAuth={setAuth} >
              </SettingsTab>
            )}
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}