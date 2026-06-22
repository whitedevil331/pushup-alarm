import fs from 'fs';
import path from 'path';

const manifestPath = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

if (!fs.existsSync(manifestPath)) {
  console.error(`AndroidManifest.xml not found at ${manifestPath}`);
  process.exit(1);
}

let content = fs.readFileSync(manifestPath, 'utf8');

const permissionsToAdd = [
  '<uses-permission android:name="android.permission.CAMERA" />',
  '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
  '<uses-permission android:name="android.permission.WAKE_LOCK" />',
  '<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />',
  '<uses-permission android:name="android.permission.USE_EXACT_ALARM" />'
];

const featuresToAdd = [
  '<uses-feature android:name="android.hardware.camera" android:required="false" />'
];

// Check if each permission already exists, if not add it
let additions = [];
for (const p of permissionsToAdd) {
  if (!content.includes(p)) {
    additions.push(`    ${p}`);
  }
}

for (const f of featuresToAdd) {
  if (!content.includes(f)) {
    additions.push(`    ${f}`);
  }
}

if (additions.length > 0) {
  const applicationTag = '<application';
  if (content.includes(applicationTag)) {
    content = content.replace(applicationTag, `${additions.join('\n')}\n\n    ${applicationTag}`);
    fs.writeFileSync(manifestPath, content, 'utf8');
    console.log('Successfully added Android permissions to Manifest:', additions);
  } else {
    console.error('Could not find <application tag in AndroidManifest.xml');
    process.exit(1);
  }
} else {
  console.log('All android permissions are already present in AndroidManifest.xml');
}
