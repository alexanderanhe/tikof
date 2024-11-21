import express from "express";
import fileUpload from "express-fileupload";
import supabase from "../lib/db.js";

const router = express.Router();

router.use(fileUpload({
  // Configure file uploads with maximum file size 10MB
  limits: { fileSize: 10 * 1024 * 1024 },

  // Temporarily store uploaded files to disk, rather than buffering in memory
  useTempFiles : true,
  tempFileDir : '/tmp/'
}));

router.post('/', async function(req, res, next) {
  // Was a file submitted?
  if (!req.files || !req.files.file) {
    return res.status(422).send('No files were uploaded');
  }

  const uploadedFile = req.files.file;

  // Print information about the file to the console
  console.log(`File Name: ${uploadedFile.name}`);
  console.log(`File Size: ${uploadedFile.size}`);
  console.log(`File MD5 Hash: ${uploadedFile.md5}`);
  console.log(`File Mime Type: ${uploadedFile.mimetype}`);

  const { data, error: errorStorage } = await supabase
    .storage
    .from('videos')
    .upload(`public/${uploadedFile.name}`, uploadedFile, {
    upsert: true,
  });
  if (errorStorage) {
    console.log({errorStorage});
    res.status(500).send('Error uploading file');
  }

  // Return a web page showing information about the file
  res.send(`File Name: ${uploadedFile.name}<br>
  File Size: ${uploadedFile.size}<br>
  File MD5 Hash: ${uploadedFile.md5}<br>
  File Mime Type: ${uploadedFile.mimetype}`);
});

export default router;