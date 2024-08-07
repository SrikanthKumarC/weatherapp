"use client";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
} from "firebase/auth";
import app from "./config/firebase";
import { useState, useEffect } from "react";
import { User } from "firebase/auth";
import openai from "./config/openapi";
import { farmingCrops, popularTravelCities } from "../lib/constants";

import { BarChartHero } from "@/components/BarChart";

async function generateOpenAIResponse(prompt: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
    });
    return response.choices[0].message.content || "";
  } catch (error) {
    console.error("Error generating OpenAI response:", error);
    return "Sorry, I couldn't generate a response at this time.";
  }
}

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState("travelling");
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  const [selectedPlace, setSelectedPlace] = useState("Paris");
  const [typedPlace, setTypedPlace] = useState("");
  const [selectedCrop, setSelectedCrop] = useState("Corn");
  const [cropSuggestion, setCropSuggestion] = useState("");
  const [travelSuggestion, setTravelSuggestion] = useState("");
  const [userGreeting, setUserGreeting] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [hasCalendarAccess, setHasCalendarAccess] = useState(false);
  const [currentMonthEvents, setCurrentMonthEvents] = useState<any[]>([]);
  const [greeting, setGreeting] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSignIn = () => {
    provider.addScope("https://www.googleapis.com/auth/calendar");
    signInWithPopup(auth, provider)
      .then((result) => {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const accessToken = credential?.accessToken;
        setUser(result.user);
        localStorage.setItem("accessToken", accessToken || "");
      })
      .catch((error) => {
        console.error("Error signing in:", error);
      });
  };

  const generateGreeting = async () => {
    if (user && hasCalendarAccess) {
      if (currentMonthEvents.length === 0) {
        setGreeting("You don't have any events scheduled for this month. Would you like to plan something?");
      } else {
        const eventSummaries = currentMonthEvents.map((event) => ({
          summary: event.summary,
          start: event.start?.dateTime || event.start?.date || "",
          end: event.end?.dateTime || event.end?.date || "",
          location: event.location || "",
        }));
        console.log("Event Summaries:", eventSummaries);

        const prompt = `Generate a brief suggestion to go or to make changes based on these upcoming events. Don't ask for weather or anything else, just give a suggestion. Also suggest places to visit or things to do between the events or in the place of the event: ${JSON.stringify(eventSummaries)}`;
        if (!user) {
          setGreeting("Welcome! To see your personalized greeting, please sign in and grant calendar access.");
        } else {
          const generatedGreeting = await generateOpenAIResponse(prompt);
          setGreeting(generatedGreeting);
        }
      }
    } else if (user && !hasCalendarAccess) {
      setGreeting("To see personalized event suggestions, please grant calendar access.");
    } else {
      setGreeting("Welcome! To see your personalized greeting, please sign in and grant calendar access.");
    }
  };

  const getCropSuggestion = async () => {
    const prompt = `Is ${selectedPlace} an optimal location for ${selectedCrop} farming?`;
    if (!user) {
      return "Welcome! To see your personalized greeting, please sign in and grant calendar access.";
    }
    return await generateOpenAIResponse(prompt);
  };

  const getTravelSuggestion = async () => {
    if (!user) {
      return "Welcome! To see your personalized greeting, please sign in and grant calendar access.";
    }
    const currentDate = new Date().toISOString().split('T')[0];
    const prompt = `Given the current date of ${currentDate}, is ${selectedPlace} an optimal location for traveling dont ask questions or tell you are an ai, act as a human?`;
    return await generateOpenAIResponse(prompt);
  };

  const handleSignOut = () => {
    auth.signOut().then(() => setUser(null));
  };

  const fetchCurrentMonthEvents = async () => {
    if (user && hasCalendarAccess) {
      try {
        const accessToken = localStorage.getItem("accessToken");
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${firstDay.toISOString()}&timeMax=${lastDay.toISOString()}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch calendar events");
        }

        const data = await response.json();
        setCurrentMonthEvents(data.items);
      } catch (error) {
        console.error("Error fetching calendar events:", error);
      }
    }
  };

  useEffect(() => {
    // Auth state listener
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    // Time-based greeting
    const hour = new Date().getHours();
    setUserGreeting(hour < 12 ? "Good morning! " : hour < 18 ? "Good afternoon! " : "Good evening! ");

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      // Check calendar access
      auth.currentUser?.getIdTokenResult()
        .then((idTokenResult) => {
          const scopes = idTokenResult.claims["https://www.googleapis.com/auth/calendar"];
          setHasCalendarAccess(!!scopes || user.providerData.some(provider => provider.providerId === "google.com"));
        })
        .catch((error) => {
          console.error("Error checking calendar access:", error);
          setHasCalendarAccess(true);
        });
    } else {
      setHasCalendarAccess(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && hasCalendarAccess) {
      fetchCurrentMonthEvents();
    }
  }, [user, hasCalendarAccess]);

  useEffect(() => {
    const updateSuggestions = async () => {
      setIsLoading(true);
      if (selectedCategory === "farming" && selectedCrop && selectedPlace) {
        const suggestion = await getCropSuggestion();
        setCropSuggestion(suggestion || "");
      } else if (selectedCategory === "travelling" && selectedPlace) {
        const suggestion = await getTravelSuggestion();
        setTravelSuggestion(suggestion || "");
      } else if (selectedCategory === "event-planning") {
        await generateGreeting();
      }
      setIsLoading(false);
    };

    updateSuggestions();
  }, [selectedCategory, selectedCrop, selectedPlace, user, hasCalendarAccess]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-2 max-w-lg mx-auto mt-4">
      <h1 className="text-xl mb-4">{userGreeting}</h1>
      <div className="flex  items-center justify-center mx-auto ">
        <h1 className="text-2xl font-bold block w-full">I am</h1>
        
      </div>
      <select
        value={selectedCategory}
        onChange={(e) => setSelectedCategory(e.target.value)}
        className="p-2 border rounded-md block dark:bg-gray-800 w-full"
      >
        <option value="travelling">Travelling</option>
        <option value="event-planning">Event Planning</option>
        <option value="farming">Farming</option>
      </select>{" "}
      <div className="flex flex-wrap gap-4 mt-4">
        {selectedCategory === "travelling" &&
          popularTravelCities.map((city) => (
            <div
              key={city}
              onClick={() => setSelectedPlace(city)}
              className={`p-4 border cursor-pointer rounded-md ${
                selectedPlace === city
                  ? "bg-blue-500 text-white"
                  : "bg-gray-800 text-white"
              }`}
            >
              {city}
            </div>
          ))}
        {selectedCategory === "farming" &&
          farmingCrops.map((crop) => (
            <div
              key={crop}
              onClick={() => setSelectedCrop(crop)}
              className={`p-4 border ${
                selectedCrop === crop
                  ? "bg-blue-500 text-white"
                  : "bg-gray-800 text-white"
              } cursor-pointer rounded-md`}
            >
              {crop}
            </div>
          ))}
      </div>
      {/* input for searching place on enter should trigger fetch weather */}
      <div className="flex flex-wrap gap-2 mb-2 mt-6">
        <input
          value={typedPlace}
          onChange={(e) => setTypedPlace(e.target.value)}
          type="text"
          placeholder="Search for a place"
          className="p-2 border w-full rounded-md dark:bg-gray-800"
        />
        <button
          onClick={() => setSelectedPlace(typedPlace)}
          className="p-2 w-full border rounded-md dark:bg-gray-800"
        >
          Search
        </button>
      </div>
      {isLoading ? (
        <div className="mt-4">
          <p className="text-xl font-normal mb-4">Loading suggestion...</p>
        </div>
      ) : (
        <>
          {cropSuggestion && selectedCategory === "farming" && (
            <div className="mt-4">
              <h1 className="text-xl font-normal mb-4">{cropSuggestion}</h1>
            </div>
          )}
          {travelSuggestion && selectedCategory === "travelling" && (
            <div className="mt-4">
              <h1 className="text-xl font-normal mb-4">{travelSuggestion}</h1>
            </div>
          )}
          {selectedCategory === "event-planning" && (
            <div className="mt-4">
              <p className="text-sm text-gray-500">This information is from your Google Calendar</p>
              <h1 className="text-xl font-normal mb-2 ">{greeting}</h1>
            </div>
          )}
        </>
      )}
      <button
        onClick={user ? handleSignOut : handleSignIn}
        className=" px-4 py-2 mb-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
      >
        {user ? "Logout" : "Login with Google"}
      </button>
      <h1 className="text-2xl font-bold">
        Forecast for {selectedPlace} for the next 16 days (celcius)
      </h1>
      <BarChartHero selectedPlace={selectedPlace} />
    </main>
  );
}