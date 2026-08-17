// ==========================================
// GOOGLE APPS SCRIPT - ALL IN ONE BACKEND
// (List, Upload, Delete)
// ==========================================
const FOLDER_ID = 'GANTI_DENGAN_FOLDER_ID_DRIVE_LU';

// Handle GET: List files atau Delete file
function doGet(e) {
  // Kalau ada parameter action=delete
  if (e.parameter.action === 'delete') {
    return deleteFile(e.parameter.id);
  }
  // Default: List semua file
  return listFiles();
}

// Handle POST: Upload File (Gambar/Video) via Base64
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const folder = DriveApp.getFolderById(FOLDER_ID);
    
    // Decode base64
    const contentType = data.mimeType;
    const bytes = Utilities.base64Decode(data.base64);
    const blob = Utilities.newBlob(bytes, contentType, data.filename);
    
    // Simpan ke Drive
    const file = folder.createFile(blob);
    
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'success', 
      fileId: file.getId(),
      url: `https://drive.google.com/uc?export=view&id=${file.getId()}`
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'error', 
      message: error.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Fungsi List Gambar & Video
function listFiles() {
  try {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const files = folder.getFiles();
    const items = [];

    while (files.hasNext()) {
      const file = files.next();
      const mimeType = file.getMimeType();
      
      // Filter Gambar & Video
      if (mimeType.startsWith('image/') || mimeType.startsWith('video/')) {
        items.push({
          id: file.getId(),
          name: file.getName(),
          type: mimeType.startsWith('video/') ? 'video' : 'image',
          url: `https://drive.google.com/uc?export=view&id=${file.getId()}`,
          date: file.getDateCreated().getTime()
        });
      }
    }
    
    // Urutkan dari yang terbaru
    items.sort((a, b) => b.date - a.date);
    
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'success', 
      images: items // (variabel lama tetep dipake biar kompatibel)
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'error', 
      message: error.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Fungsi Delete
function deleteFile(id) {
  try {
    DriveApp.getFileById(id).setTrashed(true);
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'success' 
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'error', 
      message: err.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
