import express from 'express';
import {createClient} from '@supabase/supabase-js'
import morgan from 'morgan'
import bodyParser from "body-parser";
import { config } from 'dotenv';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'url';
import { getFiles, createVideoCollage } from './lib/files.js';
import uploadRouter from './routes/upload.js';
const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const app = express()

// using morgan for logs
app.use(morgan('combined'));

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

process.env.NODE_ENV !== 'production' && config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY,
);

const folderPath = process.env.FOLDER_PATH;
const thumbnailsFolder = path.join(folderPath, '/thumbnails');
app.use('/cdn', express.static(folderPath)); // temp
app.use('/', express.static(path.join(__dirname, '../public')));
fs.existsSync(thumbnailsFolder) && app.use('/thumbnails', express.static(thumbnailsFolder));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

const files = await getFiles({ folderPath });
const vonline = [
  {
    id: 1,
    typef: 'video',
    fileName: 'video',
    src: '/ovideo?l=https://krkpraegwzrqcmgbgzce.supabase.co/storage/v1/object/public/videos/video.mp4',
    type: { ext: 'mp4', mime: 'video/mp4' },
  }
]

const medias = files
  .filter(({ typef }) => ['video', 'image'].includes(typef))
  .toSorted(() => Math.random() - 0.5);

// medias.map(async (m) => {
//   const {data, error} = await supabase
//     .from('videos')
//     .select()
//     .eq('fileName', m.fileName)
//   if (!data.length) {
//     const {
//       fileName,
//       path,
//       src: source,
//       type,
//       typef,
//       meta,
//     } = m;
//     // const { data, error: errorStorage } = await supabase
//     //   .storage
//     //   .from('videos')
//     //   .upload(`public/${fileName}`, path, {
//     //   upsert: true,
//     // });
//     // if (errorStorage) {
//     //   console.log({errorStorage});
//     // }
//     const {error} = await supabase
//       .from('videos')
//       .insert({
//         fileName,
//         path,
//         source,
//         type,
//         typef,
//         meta,
//       })
//     if (error) {
//       console.log(error);
//     }
    
//     console.log(m.fileName, data, "created!!");
//   }
// })

// const {error} = await supabase
//         .from('videos')
//         .delete()
//         .match({ typef: 'image' })
//         console.log({error});

app.get('/', (req, res) => {
  // res.send("Hello I am working my friend to the moon and behind <3");
  res.render('pages/upload');
  // res.redirect('/v');
})

app.get('/v/:file?', (req, res) => {
  const { file } = req.params;
  let err = '';
  const files = medias//.filter(({ typef }) => typef === 'video')
    .slice(0, 2);
  if (file) {
    const video = medias.find(({ fileName }) => fileName === file);
    if (video) {
      files.unshift(video);
    } else {
      err = 'Not found';
    }
  }
  // files.push(...vonline);
  res.render('pages/home', {
    err,
    files,
  });
});

app.get('/static/video-container', (req, res) => {
  const { file } = req.query;
  res.render('partials/video/video-container', {
    typef: 'video',
    type: { ext: 'mp4', mime: 'video/mp4' },
    fileName: file,
    src: `/video?f=${file}`,
    id: file,
  });
});

app.get('/static/image-container', (req, res) => {
  const { file } = req.query;
  res.render('partials/image/image-container', {
    fileName: file,
    src: `/cdn/${file}`,
    id: file,
  });
});

app.get('/api', (req, res) => {
  const filter = req.query.media;
  const limit = parseInt(req.query.limit || 10);
  const skip = parseInt(req.query.skip || 0);
  const media = medias
    .filter((item) => filter ? item.typef.includes(filter) : true)
    .slice(skip, skip + limit);
  res.json(media);
})

app.use('/api/upload', uploadRouter);

app.get('/products', async (req, res) => {
  const {data, error} = await supabase
      .from('videos')
      .select()
  res.send(data);
});

app.post('/products', async (req, res) => {
  const {error} = await supabase
      .from('videos')
      .insert({
          name: req.body.name,
          description: req.body.description,
          path: req.body.path,
      })
  if (error) {
      res.send(error);
  }
  res.send("created!!");
});

app.get('/video', (req, res) => {
  const { f: file } = req.query;
  // Ensure there is a range given for the video
  const range = req.headers.range;
  if (!range) {
    return res.status(400).send("Requires Range header");
  }

  // get video stats (about 61MB)
  const videoPath = path.join(folderPath, file);
  if (!fs.existsSync(videoPath)) {
    return res.status(404).send("Video not found!");
  }
  const videoSize = fs.statSync(videoPath).size;

  // Parse Range
  // Example: "bytes=32324-"
  const CHUNK_SIZE = 10 ** 6; // 1MB
  const start = Number(range.replace(/\D/g, ""));
  const end = Math.min(start + CHUNK_SIZE, videoSize - 1);

  // Create headers
  const contentLength = end - start + 1;
  const headers = {
    "Content-Range": `bytes ${start}-${end}/${videoSize}`,
    "Accept-Ranges": "bytes",
    "Content-Length": contentLength,
    "Content-Type": "video/mp4",
  };

  // HTTP Status 206 for Partial Content
  res.writeHead(206, headers);

  // create video read stream for this particular chunk
  const videoStream = fs.createReadStream(videoPath, { start, end });

  // Stream the video chunk to the client
  videoStream.pipe(res);
});

app.get('/ovideo', (req, res) => {
  const { l: link } = req.query;
  // Ensure there is a range given for the video
  const range = req.headers.range;
  if (!range) {
    return res.status(400).send("Requires Range header");
  }
  
  const videoSize = 120000; // fs.statSync(videoPath).size;

  // Parse Range
  // Example: "bytes=32324-"
  const CHUNK_SIZE = 10 ** 6; // 1MB
  const start = Number(range.replace(/\D/g, ""));
  const end = Math.min(start + CHUNK_SIZE, videoSize - 1);

  // Create headers
  const contentLength = end - start + 1;
  const headers = {
    "Content-Range": `bytes ${start}-${end}/${videoSize}`,
    "Accept-Ranges": "bytes",
    "Content-Length": contentLength,
    "Content-Type": "video/mp4",
  };

  // HTTP Status 206 for Partial Content
  res.writeHead(206, headers);

  const file = fs.createWriteStream("video.mp4");
  const request = http.get(link, function(response) {
    response.pipe(res);
    const videoStream = fs.createReadStream(file.path, { start, end });
    videoStream.pipe(res);
    // after download completed close filestream
    file.on("finish", () => {
        file.close();
        console.log("Download Completed");
    });
  });
});

app.get('/collage/:file', async (req, res) => {
  const { file } = req.params;
  const videoPath = path.join(folderPath, file);
  if (!fs.existsSync(videoPath)) {
    return res.status(404).send("Video not found!");
  }
  const headers = {
    "Content-Type": "text/event-stream",
    "Cache-Type": "no-cache",
    "Access-Control-Allow-Origin": "*",
    "Connection": "keep-alive",
  };
  // HTTP Status 206 for Partial Content
  res.writeHead(206, headers);
  res.flushHeaders();

  const sendProgress = (progress, label) => {
    const data = JSON.stringify({progress, label});
    res.write(`data: ${data}\n\n`);
  }
  try {
    const video = medias.find(({ fileName }) => fileName === file);
    await createVideoCollage(video, thumbnailsFolder, sendProgress);
    res.end();
  } catch (error) {
    console.error(error);
    sendProgress(-1, "Error creating collage!!");
  }
});

// app.get('/test', async (req, res) => {
//   const headers = {
//     "Content-Type": "text/event-stream",
//     "Cache-Type": "no-cache",
//     "Access-Control-Allow-Origin": "*",
//     "Connection": "keep-alive",
//   };
//   // HTTP Status 206 for Partial Content
//   res.writeHead(206, headers);
//   res.flushHeaders();

//   for (let i = 0; i <= 100; i++) {
//     // res.write(`id: ${i}\n`);
//     // res.write(`event: onProgress\n`);
//     const chunk = JSON.stringify({chunk: i});
//     res.write(`data: ${chunk}\n\n`);
//     // res.flush();
//     await new Promise((resolve) => setTimeout(resolve, 1000));
//   }

//   // res.write(`data: END\n\n`);
//   // res.end();
// });

app.get('/testpage', async (req, res) => {
  const { file } = req.query;
  const videoPath = path.join(folderPath, file);
  if (!fs.existsSync(videoPath)) {
    return res.status(404).send("Video not found!");
  }
  const { metadata } = medias.find(({ fileName }) => fileName === file);
  const duration = Math.trunc(metadata?.format?.duration ?? 1);
  const total = Math.trunc(duration / 10) || 1;
  res.render('pages/test', { file, totalFrames: total });
});

app.get('*', (req, res) => {
  res.send("Hello again I am working my friend to the moon and behind <3");
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
});