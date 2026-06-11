import React from 'react'
import { Link } from 'react-router-dom'
import './Home.css'

export default function Home() {
  return (
    <div className="home-container">
      <header className="home-header">
        <h1 className="home-heading">Flixifit</h1>
      </header>

      <h1 className="description">A AI Yoga Trainer</h1>

      <div className="image-card">
        <img
          src="/yoga_pose.png" // Ensure this image is inside the public/ folder
          alt="Futuristic Yoga Pose"
          className="pose-image"
        />
      </div>

      <div className="btn-section">
        <Link to="/start" className="btn start-btn">
          Let's Start
        </Link>
      </div>
    </div>
  )
}
