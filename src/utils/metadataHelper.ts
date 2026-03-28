import * as piexif from "piexifjs";

export const addExifMetadata = (
  base64Image: string,
  latitude: number | null,
  longitude: number | null,
  date: Date
): string => {
  try {
    let exifObj: any;

    const isDataUrl = base64Image.startsWith("data:");
    const imageString = isDataUrl ? base64Image : `data:image/jpeg;base64,${base64Image}`;

    try {
      exifObj = piexif.load(imageString);
    } catch (e) {
      exifObj = { "0th": {}, Exif: {}, GPS: {} };
    }

    if (!exifObj["GPS"]) exifObj["GPS"] = {};
    if (!exifObj["Exif"]) exifObj["Exif"] = {};

    if (latitude !== null && longitude !== null) {
      exifObj["GPS"][piexif.GPSIFD.GPSLatitude] = piexif.GPSHelper.degToDmsRational(Math.abs(latitude));
      exifObj["GPS"][piexif.GPSIFD.GPSLatitudeRef] = latitude >= 0 ? "N" : "S";

      exifObj["GPS"][piexif.GPSIFD.GPSLongitude] = piexif.GPSHelper.degToDmsRational(Math.abs(longitude));
      exifObj["GPS"][piexif.GPSIFD.GPSLongitudeRef] = longitude >= 0 ? "E" : "W";
    }

    // Add DateTimeOriginal in EXIF format (YYYY:MM:DD HH:MM:SS)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const formattedDate = `${year}:${month}:${day} ${hours}:${minutes}:${seconds}`;

    exifObj["Exif"][piexif.ExifIFD.DateTimeOriginal] = formattedDate;

    const exifBytes = piexif.dump(exifObj);
    const updatedBase64 = piexif.insert(exifBytes, imageString);

    if (!isDataUrl) {
      return updatedBase64.replace(/^data:image\/jpeg;base64,/, "");
    }

    return updatedBase64;
  } catch (err) {
    console.error("Error setting EXIF metadata:", err);
    return base64Image;
  }
};
