'use client'
import { useState, useEffect } from 'react';
import { BarChart } from '@tremor/react';
const WEATHER_API = "https://api.open-meteo.com/v1/forecast"

const chartdata = [
    {
        name: 'Amphibians',
        'Number of threatened species': 2488,
    },
    {
        name: 'Birds',
        'Number of threatened species': 1445,
    },
    {
        name: 'Crustaceans',
        'Number of threatened species': 743,
    },
    {
        name: 'Ferns',
        'Number of threatened species': 281,
    },
    {
        name: 'Arachnids',
        'Number of threatened species': 251,
    },
    {
        name: 'Corals',
        'Number of threatened species': 232,
    },
    {
        name: 'Algae',
        'Number of threatened species': 98,
    },
];

const dataFormatter = (number: number) =>
    Intl.NumberFormat('us').format(number).toString();

export const BarChartHero = ({ selectedPlace }: { selectedPlace: string }) => {
    const [data, setData] = useState([]);
    const [rainfallData, setRainfallData] = useState([]);
    const [currentTemp, setCurrentTemp] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const getCoordinates = async (place: string) => {
        try {
            const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${place}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`);
            const data = await response.json();
            if (!data.results || data.results.length === 0) {
                throw new Error('Place not found');
            }
            return data.results[0]?.geometry?.location;
        } catch (error) {
            console.error('Error getting coordinates:', error);
            throw error;
        }
    }

    useEffect(() => {
        const fetchData = async () => {
            if (selectedPlace.length < 4) return;
            setError(null);
            try {
                const coordinates = await getCoordinates(selectedPlace);
                const response = await fetch(WEATHER_API + `?latitude=${coordinates.lat}&longitude=${coordinates.lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&current_weather=true&timezone=auto&forecast_days=16`);
                const data = await response.json();
                
                const chartData = data.daily.time.map((date: string, index: number) => ({
                    name: date,
                    'Temperature': data.daily.temperature_2m_max[index],
                    'Rainfall': data.daily.precipitation_sum[index],
                }));    
                
                setData(chartData);
                setRainfallData(data.daily.precipitation_sum);
                setCurrentTemp(data.current_weather.temperature);
            } catch (error) {
                console.error('Error fetching data:', error);
                setError('Unable to fetch weather data for the selected place.');
                setData([]);
                setCurrentTemp(null);
            }
        };
        fetchData();
    }, [selectedPlace]);

    if (error) {
        return <div>{error}</div>;
    }

    return (
        <div className='w-full'>
            {currentTemp !== null && (
                <div>Current Temperature: {currentTemp}°C</div>
            )}
            <BarChart
                data={data}
                index="name"
                categories={['Temperature', 'Rainfall']}
                colors={['blue', 'sky']}
                className='w-full'
                valueFormatter={dataFormatter}
                yAxisWidth={48}
                onValueChange={(v) => console.log(v)}
            />
        </div>
    );
};