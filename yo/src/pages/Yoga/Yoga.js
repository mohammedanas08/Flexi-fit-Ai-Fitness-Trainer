import * as poseDetection from '@tensorflow-models/pose-detection';
import * as tf from '@tensorflow/tfjs';
import React, { useRef, useState, useEffect } from 'react';
import '@tensorflow/tfjs-backend-webgl';
import Webcam from 'react-webcam';
import { count } from '../../utils/music';

import Instructions from '../../components/Instrctions/Instructions';
import DropDown from '../../components/DropDown/DropDown';
import { poseImages } from '../../utils/pose_images';
import { POINTS, keypointConnections } from '../../utils/data';
import { drawPoint, drawSegment } from '../../utils/helper';

import './Yoga.css';

// ---------- GLOBAL SETTINGS ----------
let skeletonColor = 'rgb(255,255,255)';
let poseList = ['Tree', 'Chair', 'Cobra', 'Warrior', 'Dog', 'Shoulderstand', 'Traingle'];

let interval;
let flag = false;

// CLASS INDEXES MUST MATCH YOUR MODEL TRAINING ORDER
const CLASS_NO = {
  Chair: 0,
  Cobra: 1,
  Dog: 2,
  No_Pose: 3,
  Shoulderstand: 4,
  Traingle: 5,
  Tree: 6,
  Warrior: 7,
};

function Yoga() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);

  const [startingTime, setStartingTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [poseTime, setPoseTime] = useState(0);
  const [bestPerform, setBestPerform] = useState(0);
  const [currentPose, setCurrentPose] = useState('Tree');
  const [isStartPose, setIsStartPose] = useState(false);

  // -----------------------------------
  // PERFORMANCE TIMER
  // -----------------------------------
  useEffect(() => {
    const timeDiff = (currentTime - startingTime) / 1000;
    if (flag) setPoseTime(timeDiff);
    if (timeDiff > bestPerform) setBestPerform(timeDiff);
  }, [currentTime]);

  useEffect(() => {
    setCurrentTime(0);
    setPoseTime(0);
    setBestPerform(0);
  }, [currentPose]);

  // -----------------------------------
  // LANDMARK PROCESSING
  // -----------------------------------
  function get_center_point(landmarks, left_bodypart, right_bodypart) {
    const left = tf.gather(landmarks, left_bodypart, 1);
    const right = tf.gather(landmarks, right_bodypart, 1);
    return tf.add(tf.mul(left, 0.5), tf.mul(right, 0.5));
  }

  function get_pose_size(landmarks, torso_size_multiplier = 2.5) {
    const hips_center = get_center_point(landmarks, POINTS.LEFT_HIP, POINTS.RIGHT_HIP);
    const shoulders_center = get_center_point(
      landmarks,
      POINTS.LEFT_SHOULDER,
      POINTS.RIGHT_SHOULDER
    );

    const torso_size = tf.norm(tf.sub(shoulders_center, hips_center));
    let pose_center_new = get_center_point(landmarks, POINTS.LEFT_HIP, POINTS.RIGHT_HIP);

    pose_center_new = tf.expandDims(pose_center_new, 1);
    pose_center_new = tf.broadcastTo(pose_center_new, [1, 17, 2]);

    const d = tf.gather(tf.sub(landmarks, pose_center_new), 0, 0);
    const max_dist = tf.max(tf.norm(d, 'euclidean', 0));

    return tf.maximum(tf.mul(torso_size, torso_size_multiplier), max_dist);
  }

  function normalize_pose_landmarks(landmarks) {
    let pose_center = get_center_point(landmarks, POINTS.LEFT_HIP, POINTS.RIGHT_HIP);
    pose_center = tf.expandDims(pose_center, 1);
    pose_center = tf.broadcastTo(pose_center, [1, 17, 2]);

    landmarks = tf.sub(landmarks, pose_center);

    const pose_size = get_pose_size(landmarks);
    return tf.div(landmarks, pose_size);
  }

  function landmarks_to_embedding(landmarks) {
    landmarks = normalize_pose_landmarks(tf.expandDims(landmarks, 0));
    return tf.reshape(landmarks, [1, 34]);
  }

  // -----------------------------------
  // TFJS BACKEND INIT + MODEL LOADING
  // -----------------------------------

  let poseClassifier = null;

  const initTF = async () => {
    await tf.setBackend("webgl");
    await tf.ready();
    console.log("⚡ TFJS backend ready");
  };

  const loadClassifierModel = async () => {
    poseClassifier = await tf.loadLayersModel(
      "/classification model/model/model.json"
    );
    console.log("📌 Local classifier model loaded");
  };

  // -----------------------------------
  // MOVENET + DETECTION
  // -----------------------------------

  const runMovenet = async () => {
    const detectorConfig = {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
    };

    const detector = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet,
      detectorConfig
    );

    const countAudio = new Audio(count);
    countAudio.loop = true;

    interval = setInterval(() => {
      detectPose(detector, poseClassifier, countAudio);
    }, 100);
  };

  const detectPose = async (detector, poseClassifier, countAudio) => {
    if (
      typeof webcamRef.current !== "undefined" &&
      webcamRef.current !== null &&
      webcamRef.current.video.readyState === 4
    ) {
      const video = webcamRef.current.video;
      const pose = await detector.estimatePoses(video);

      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      try {
        const keypoints = pose[0].keypoints;
        let notDetected = 0;

        // Draw skeleton
        let input = keypoints.map((keypoint) => {
          if (keypoint.score > 0.4) {
            if (!(keypoint.name === "left_eye" || keypoint.name === "right_eye")) {
              drawPoint(ctx, keypoint.x, keypoint.y, 8, "rgb(255,255,255)");
              const connections = keypointConnections[keypoint.name] || [];
              connections.forEach((connection) => {
                const conName = connection.toUpperCase();
                drawSegment(
                  ctx,
                  [keypoint.x, keypoint.y],
                  [keypoints[POINTS[conName]].x, keypoints[POINTS[conName]].y],
                  skeletonColor
                );
              });
            }
          } else {
            notDetected++;
          }
          return [keypoint.x, keypoint.y];
        });

        if (notDetected > 4) {
          skeletonColor = "rgb(255,255,255)";
          return;
        }

        const processedInput = landmarks_to_embedding(input);
        const classification = poseClassifier.predict(processedInput);

        classification.array().then((data) => {
          const classNo = CLASS_NO[currentPose];

          if (data[0][classNo] > 0.97) {
            if (!flag) {
              countAudio.play();
              setStartingTime(Date.now());
              flag = true;
            }
            setCurrentTime(Date.now());
            skeletonColor = "rgb(0,255,0)";
          } else {
            flag = false;
            skeletonColor = "rgb(255,255,255)";
            countAudio.pause();
            countAudio.currentTime = 0;
          }
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  // -----------------------------------
  // BUTTON ACTIONS
  // -----------------------------------

  function startYoga() {
    setIsStartPose(true);

    initTF().then(() => {
      loadClassifierModel().then(() => {
        runMovenet();
      });
    });
  }

  function stopPose() {
    setIsStartPose(false);
    clearInterval(interval);
  }

  // -----------------------------------
  // UI
  // -----------------------------------

  if (isStartPose) {
    return (
      <div className="yoga-container">
        <div className="performance-container">
          <div className="pose-performance">
            <h4>Pose Time: {poseTime.toFixed(2)} s</h4>
          </div>
          <div className="pose-performance">
            <h4>Best: {bestPerform.toFixed(2)} s</h4>
          </div>
        </div>

        <div className="camera-wrapper">
          <Webcam ref={webcamRef} id="webcam" width={640} height={480} />
          <canvas ref={canvasRef} id="my-canvas" width={640} height={480} />
        </div>

        <div>
          <img src={poseImages[currentPose]} className="pose-img" alt="" />
        </div>

        <button onClick={stopPose} className="secondary-btn">
          Stop Pose
        </button>
      </div>
    );
  }

  return (
    <div className="yoga-container">
      <DropDown poseList={poseList} currentPose={currentPose} setCurrentPose={setCurrentPose} />
      <Instructions currentPose={currentPose} />
      <button onClick={startYoga} className="secondary-btn">
        Start Pose
      </button>
    </div>
  );
}

export default Yoga;
