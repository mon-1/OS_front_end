import React, { useState, useEffect } from "react";
import "./GeoBlock.css";

// List of restricted countries (ISO country codes)
// This list should be updated based on your compliance requirements
const RESTRICTED_COUNTRIES = [
  "CU", // Cuba
  "IR", // Iran
  "KP", // North Korea
  "SY", // Syria
  "RU", // Russia
  "BY", // Belarus
  "US", // United States
  // Add more countries as needed
];

// Friendly country names for display purposes
const COUNTRY_NAMES = {
  CU: "Cuba",
  IR: "Iran",
  KP: "North Korea",
  SY: "Syria",
  RU: "Russia",
  BY: "Belarus",
  US: "United",
  // Add more country names as needed
};

const GeoBlock = ({ children }) => {
  const [isBlocked, setIsBlocked] = useState(false);
  const [country, setCountry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkLocation = async () => {
      try {
        // Use a free geolocation API
        // Consider using a more reliable service in production
        const response = await fetch("https://geolocation-db.com/json/");
        const data = await response.json();

        if (data && data.country_code) {
          setCountry(data.country_code);

          // Check if user's country is in the restricted list
          if (RESTRICTED_COUNTRIES.includes(data.country_code)) {
            setIsBlocked(true);
          }
        } else {
          throw new Error("Could not determine location");
        }
      } catch (err) {
        console.error("Geolocation error:", err);
        setError("Unable to verify your region. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    checkLocation();
  }, []);

  if (loading) {
    return (
      <div className="geo-loading">
        <div className="geo-loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    // If there's an error determining location, we let the user proceed
    // but you may want to handle this differently
    return children;
  }

  if (isBlocked) {
    return (
      <div className="geo-block-container">
        <div className="geo-block-content">
          <h2>Service Not Available in Your Region</h2>
          <p>
            We're sorry, but Omni Staker is currently not available in{" "}
            {COUNTRY_NAMES[country] || country} due to regulatory restrictions.
          </p>
          <p>
            This restriction is in place to comply with international
            regulations and sanctions.
          </p>
          <div className="geo-block-footer">
            <p>
              If you believe this is an error or are using a VPN, please note
              that our service requires your actual location for compliance
              purposes.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If not blocked, render the application
  return children;
};

export default GeoBlock;
