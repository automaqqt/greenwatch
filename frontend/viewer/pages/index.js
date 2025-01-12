import { useState, useEffect } from "react";
import Head from "next/head";
import styles from "../styles/Home.module.css";
import axios from "axios";
import { Line } from "react-chartjs-2";
import dynamic from 'next/dynamic';

const DatePicker = dynamic(() => import('antd/es/date-picker'), { ssr: false });
const Slider = dynamic(() => import('antd/es/slider'), { ssr: false });


export default function Home() {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [pictures, setPictures] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(12);
  const [currentPicture, setCurrentPicture] = useState(null);
  const [tempData, setTempData] = useState([]);
  const [humidityData, setHumidityData] = useState([]);
  const [nearestData, setNearestData] = useState({ temp: null, humidity: null });

  const authenticate = async () => {
    // Simple hardcoded authentication for demo purposes
    if (username === "admin" && password === "password") {
      setAuthenticated(true);
      fetchPictures();
      fetchData();
    } else {
      alert("Invalid username or password.");
    }
  };

  const fetchPictures = async () => {
    // Replace with your backend endpoint for fetching picture metadata
    const response = await axios.get("http://192.168.178.23:5000/pictures");
    setPictures(response.data);
  };

  const fetchData = async () => {
    const tempResponse = await axios.get("http://192.168.178.23:5000/temp");
    const humidityResponse = await axios.get("http://192.168.178.23:5000/humidity");

    setTempData(tempResponse.data);
    setHumidityData(humidityResponse.data);
  };

  const findNearestData = (timestamp) => {
    const nearestTemp = tempData.reduce((prev, curr) =>
      Math.abs(new Date(curr.timestamp) - timestamp) <
      Math.abs(new Date(prev.timestamp) - timestamp)
        ? curr
        : prev
    );

    const nearestHumidity = humidityData.reduce((prev, curr) =>
      Math.abs(new Date(curr.timestamp) - timestamp) <
      Math.abs(new Date(prev.timestamp) - timestamp)
        ? curr
        : prev
    );

    setNearestData({ temp: nearestTemp?.value, humidity: nearestHumidity?.value });
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    updateCurrentPicture(date, selectedTime);
  };

  const handleTimeChange = (time) => {
    setSelectedTime(time);
    updateCurrentPicture(selectedDate, time);
  };

  const updateCurrentPicture = (date, time) => {
    if (!date || time === null) return;

    const targetTimestamp = new Date(date.format("YYYY-MM-DD") + `T${time}:00:00`);
    const picture = pictures.find(
      (pic) => Math.abs(new Date(pic.timestamp) - targetTimestamp) < 300000 // 5 minutes
    );

    setCurrentPicture(picture);
    findNearestData(targetTimestamp);
  };

  if (!authenticated) {
    return (
      <div className={styles.container}>
        <Head>
          <title>Login</title>
        </Head>

        <main className={styles.main}>
          <h1>Login</h1>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button onClick={authenticate}>Login</button>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Picture Viewer</title>
      </Head>

      <main className={styles.main}>
        <h1>Picture Viewer</h1>

        <div style={{ display: "flex", gap: "1rem" }}>
          <DatePicker onChange={handleDateChange} />
          <Slider
            min={0}
            max={23}
            value={selectedTime}
            onChange={handleTimeChange}
            marks={{ 0: "00:00", 23: "23:00" }}
          />
        </div>

        {currentPicture ? (
          <div>
            <h3>Current Picture</h3>
            <img
              src={currentPicture.url}
              alt="Captured scene"
              style={{ maxWidth: "100%", border: "1px solid black" }}
            />
            <p>Timestamp: {new Date(currentPicture.timestamp).toLocaleString()}</p>
            <p>Temperature: {nearestData.temp}°C</p>
            <p>Humidity: {nearestData.humidity}%</p>
          </div>
        ) : (
          <p>No picture available for the selected time.</p>
        )}

        <div>
          <h3>Temperature and Humidity Trends</h3>
          <Line
            data={{
              labels: tempData.map((entry) => new Date(entry.timestamp).toLocaleTimeString()),
              datasets: [
                {
                  label: "Temperature (°C)",
                  data: tempData.map((entry) => entry.value),
                  borderColor: "#FF6384",
                  backgroundColor: "rgba(255, 99, 132, 0.2)",
                },
                {
                  label: "Humidity (%)",
                  data: humidityData.map((entry) => entry.value),
                  borderColor: "#36A2EB",
                  backgroundColor: "rgba(54, 162, 235, 0.2)",
                },
              ],
            }}
          />
        </div>
      </main>
    </div>
  );
}
