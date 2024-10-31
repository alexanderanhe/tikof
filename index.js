const express = require('express')
const app = express()
const port = 3000
require('dotenv').config();
const folderPath = process.env.FOLDER_PATH;
app.use('/cdn', express.static(folderPath));
app.use('/', express.static('assets'));
app.set('view engine', 'ejs');

const fs = require('node:fs');
const path = require('node:path'); 
const isFile = ({path}) => {
  return fs.lstatSync(path).isFile();
};

const files = fs.readdirSync(folderPath)
  .map(fileName => ({
    fileName,
    path: path.join(folderPath, fileName),
    extension: path.extname(fileName).toLowerCase()
  }))
  .filter(isFile)
  .filter(({fileName}) => !fileName.startsWith("._"));

const data = [];
const EXTENSION = '.csv';
const { parse } = require("csv-parse");
files.filter(({ extension }) => extension === EXTENSION)
.forEach(async ({path}) => {
  try {
    fs.createReadStream(path)
      .pipe(parse({ delimiter: ",", from_line: 2 }))
      .on("data", function (row) {
        if (data[row[3]]) return;
        data[row[3]] = {
          fileName: row[3],
          thumbnail: row[1],
          description: row[4],
          created_at: row[0],
        };
      })
  } catch (error) {
    console.error(error);
  }
});
var ffmpeg = require('fluent-ffmpeg');
const medias = files
  .filter(({ extension }) => ['.jpg', '.png', '.mp4'].includes(extension))
  .map((file) => {
    const mdata = {};
    ffmpeg.ffprobe(file.path, function(err, metadata) {
      // console.log(file.path, metadata);
      metadata?.streams?.forEach(function(stream) {
        mdata.codec_type = stream.codec_type;
        mdata.width = stream.width;
        mdata.height = stream.height;
        mdata.videoCodec = stream.codec_name;
        mdata.ratio = stream.display_aspect_ratio;
      });
    });

    return {
      ...file,
      ...(data[file.fileName] || {}),
      ...mdata,
    }
  })
  .toSorted(() => Math.random() - 0.5);


app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.get('/v', (req, res) => {
  const { file } = req.params;
  res.render('pages/home', {
    videos: medias.filter(({ extension }) => extension === '.mp4')
      .slice(0, 2).map(({ fileName: file }) => (
      {
        file,
        source: `/video?f=${file}`,
        previews: []
      }
    ))
  });
});

app.get('/static/video-container', (req, res) => {
  const { file } = req.query;
  res.render('partials/video/video-container', {
    file
  });
});

app.get('/api', (req, res) => {
  const filter = req.query.media;
  const limit = parseInt(req.query.limit || 10);
  const skip = parseInt(req.query.skip || 0);
  const media = medias
    .filter((item) => filter ? item.extension.includes(filter) : true)
    .slice(skip, skip + limit);
  res.json(media);
})

app.get('/video', (req, res) => {
  const { f: file } = req.query;
  // Ensure there is a range given for the video
  const range = req.headers.range;
  if (!range) {
    return res.status(400).send("Requires Range header");
  }

  // get video stats (about 61MB)
  const videoPath = path.join(folderPath, file);
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

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
});