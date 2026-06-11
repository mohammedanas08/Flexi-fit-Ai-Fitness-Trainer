import React, { useState, useRef, useEffect } from "react";
import { poseImages } from "../../utils/pose_images";
import "./DropDown.css";

export default function DropDown({ poseList, currentPose, setCurrentPose }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="dropdown-container" ref={wrapperRef}>
      {/* BUTTON */}
      <button
        id="pose-dropdown-btn"
        onClick={() => setOpen(!open)}
      >
        {currentPose} ▼
      </button>

      {/* MENU */}
      {open && (
        <ul className="dropdown-custom-menu">
          {poseList.map((pose, index) => (
            <li
              key={index}
              onClick={() => {
                setCurrentPose(pose);
                setOpen(false);
              }}
            >
              <div className="dropdown-item-container">
                <p className="dropdown-item-1">{pose}</p>
                <img src={poseImages[pose]} className="dropdown-img" alt={pose} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
