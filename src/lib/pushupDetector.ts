import * as poseDetection from '@tensorflow-models/pose-detection';

export function calculateAngle(
  a: poseDetection.Keypoint,
  b: poseDetection.Keypoint,
  c: poseDetection.Keypoint
): number {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);

  if (angle > 180.0) {
    angle = 360.0 - angle;
  }
  return angle;
}

export class PushupCounter {
  private stage: 'down' | 'up' | null = null;
  private count = 0;

  public update(poses: poseDetection.Pose[]): { count: number; stage: string | null; keypoints: poseDetection.Keypoint[] } {
    if (poses.length === 0) {
      return { count: this.count, stage: this.stage, keypoints: [] };
    }

    const pose = poses[0];
    const keypoints = pose.keypoints;

    // Check minimum confidence score
    const minConfidence = 0.3;
    
    const leftShoulder = keypoints.find((k) => k.name === 'left_shoulder');
    const leftElbow = keypoints.find((k) => k.name === 'left_elbow');
    const leftWrist = keypoints.find((k) => k.name === 'left_wrist');

    const rightShoulder = keypoints.find((k) => k.name === 'right_shoulder');
    const rightElbow = keypoints.find((k) => k.name === 'right_elbow');
    const rightWrist = keypoints.find((k) => k.name === 'right_wrist');

    let angle = 0;
    
    // Choose the side with better confidence
    const leftConfidence = Math.min(leftShoulder?.score || 0, leftElbow?.score || 0, leftWrist?.score || 0);
    const rightConfidence = Math.min(rightShoulder?.score || 0, rightElbow?.score || 0, rightWrist?.score || 0);

    if (leftConfidence > minConfidence && leftConfidence > rightConfidence) {
      if (leftShoulder && leftElbow && leftWrist) {
         angle = calculateAngle(leftShoulder, leftElbow, leftWrist);
      }
    } else if (rightConfidence > minConfidence) {
      if (rightShoulder && rightElbow && rightWrist) {
         angle = calculateAngle(rightShoulder, rightElbow, rightWrist);
      }
    } else {
       // Fallback logic for front-facing where elbows might be hidden
       const nose = keypoints.find(k => k.name === 'nose');
       if (nose && leftWrist && rightWrist && leftShoulder && rightShoulder && nose.score && nose.score > minConfidence && leftWrist.score && leftWrist.score > minConfidence) {
          const avgWristY = (leftWrist.y + rightWrist.y) / 2;
          const dist = Math.abs(avgWristY - nose.y);
          const shoulderWidth = Math.max(Math.abs(leftShoulder.x - rightShoulder.x), 50); // prevent div by zero
          const normalizedDist = dist / shoulderWidth;
          
          if (normalizedDist > 1.2) angle = 150; 
          else if (normalizedDist < 0.6) angle = 80;
          else angle = 120; // middle
       } else {
         return { count: this.count, stage: this.stage, keypoints, angle };
       }
    }

    // Pushup logic:
    // When angle < 100, we are "down" (more forgiving)
    // When angle > 140, we are "up"
    if (angle > 140) {
      if (this.stage === 'down') {
        this.count += 1;
      }
      this.stage = 'up';
    } else if (angle < 100) {
      this.stage = 'down';
    }

    return { count: this.count, stage: this.stage, keypoints, angle };
  }
  
  public reset() {
    this.count = 0;
    this.stage = null;
  }
  
  public getCount() {
    return this.count;
  }
}
