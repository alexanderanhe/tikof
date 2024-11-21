import fs from 'node:fs';
import path from 'node:path';
import {fileTypeFromFile} from 'file-type';
import { parse } from 'csv-parse';
import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';

async function getFiles({ folderPath }) {
  const isFile = (file) => {
    return file?.path && fs.lstatSync(file.path).isFile();
  };
  const metadata = (pathname) => new Promise((resolve, reject) => {
    ffmpeg.ffprobe(pathname, function(err, metadata) {
      if (err) reject(err);
      const mdata = {
        format: metadata?.format,
        streams: metadata?.streams?.filter((stream) => stream.codec_type === 'video').map((stream) => ({
          codec_type: stream.codec_type,
          width: stream.width,
          height: stream.height,
          videoCodec: stream.codec_name,
          ratio: stream.display_aspect_ratio,
        })),
      };
      resolve(mdata);
    })
  });
  const files = await Promise.allSettled(fs.readdirSync(folderPath)
    .filter((fileName) => !fileName.startsWith('.'))
    .map(async (fileName) => {
      const pathname = path.join(folderPath, fileName);
      const type = await fileTypeFromFile(pathname);
      const meta = await metadata(pathname);
      const typef = type?.mime.split('/')[0];
      const source = typef === 'video' ? `/video?f=${fileName}` : `/cdn/${fileName}`;
      return {
        id: fileName,
        fileName,
        path: pathname,
        type,
        typef,
        metadata: {
          ...meta,
          streams: meta.streams.at(0),
        },
        src: source,
      }
    }))
    .then((results) => results.map(({ value }) => value));
  return files.filter(isFile);
}

async function getData(files) {
  const data = [];
  const EXTENSION = 'csv';
  files.filter(({ type }) => type?.ext === EXTENSION)
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
  return data;
}

async function createVideoCollage({ path: pathname, metadata, fileName }, destination, resWrite) {
  const THUMBNAIL_HEIGHT = 68;
  const THUMBNAIL_WIDTH = 120;

  const { streams } = metadata;
  const { width, height } = streams;
  // const scaleWidth = Math.trunc((THUMBNAIL_HEIGHT / height) * width);
  // const resolution = `${scaleWidth > THUMBNAIL_WIDTH ? THUMBNAIL_WIDTH : scaleWidth}x${THUMBNAIL_HEIGHT}`;
  const scaleHeight = Math.trunc((THUMBNAIL_WIDTH / width) * height);
  const resolution = `${THUMBNAIL_WIDTH}x${scaleHeight}`;
  
  const duration = Math.trunc(metadata?.format?.duration ?? 1);
  const total = Math.trunc(duration / 10) || 1;

  const newdir = path.join(destination, fileName);
  if (!fs.existsSync(newdir)) {
    fs.mkdirSync(newdir);
  }

  const intervalFn = setInterval(() => {
    fs.readdir(newdir, (err, files) => {
      const progress = Math.trunc((files.length / total) * 100);
      resWrite(progress, `${files.length} / ${total}`);
    });
  }, 1000);

  const timemarks = Array.from({length: total}, (_, i) => { // each 10 seconds
    const seconds = i * 10;
    const hor = Math.trunc(seconds / 3600);
    const min = Math.trunc((seconds % 3600) / 60);
    const sec = Math.trunc(seconds % 60);

    return `${hor}:${min}:${sec}.000`;
  });

  const images = await new Promise((resolve, reject) => {
    let files = [];
    ffmpeg({ source: pathname })
      .on('filenames', function(filenames) {
        console.log('Will generate ' + filenames.join(', '));
        resWrite(0, "Will generate " + filenames.length + " screenshots");
        files = filenames;
      })
      .on('end', function() {
        console.log('Screenshots taken');
        clearInterval(intervalFn);
        resolve(files);
      })
      .on('error', function(err) {
        console.error(err);
        reject(err);
      })
      .takeScreenshots({
        count: total,
        timemarks,
        filename: `thumbnail-%i.jpg`,
        // size: `${THUMBNAIL_WIDTH}x${THUMBNAIL_HEIGHT}`, //'320x240'
        size: resolution, //'320x240'

      }, newdir);
  });
  const imagesPath = images.map((image) => path.join(newdir, image));
  const MOZAIQUEMIN_WIDTH = THUMBNAIL_WIDTH * (imagesPath.length > 10 ? 10 : imagesPath.length);
  const MOZAIQUEMIN_HEIGHT = THUMBNAIL_HEIGHT * (Math.trunc(total / 10) + (total % 10 ? 1 : 0));

  const collage = sharp({
    create: {
      width: MOZAIQUEMIN_WIDTH,
      height: MOZAIQUEMIN_HEIGHT,
      channels: 3,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    }
  });
  // Read and resize each image to a fixed width
  const resizedImages = imagesPath.map((image) => 
    sharp(image).resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT).toBuffer()
  );
  const collageImage = path.join(destination, `${fileName}-collage.jpg`);
  await Promise.all(resizedImages)
    .then((buffers) => {
      const composite = buffers.map((buffer, index) => {
        const x = (index % 10) * THUMBNAIL_WIDTH;
        const y = Math.trunc(index / 10) * THUMBNAIL_HEIGHT;
        return { input: buffer, top: y, left: x };
      });
      return collage
        .composite(composite)
        .toFile(collageImage, (err, info) => {
          if (err) {
            // console.error("Error creating collage:", err);
            resWrite(-1, `Error creating collage ${err.message}`);
          }
          /** console.log("Collage created successfully:", info);
           * {
              format: 'jpeg',
              width: 1200,
              height: 68,
              channels: 3,
              premultiplied: false,
              size: 2230
            }
           */
          resWrite(100, "Collage created successfully");
        });
    })
    .catch((error) => {
      console.error("Error processsing images:", error);
      resWrite(-1, "ERROR: " + error.message);
      throw error;
    })
    .finally(() => {
      // imagesPath.forEach((image) => fs.unlinkSync(image));
      resWrite(100);
    });
  return collageImage;
}

export { getFiles, getData, createVideoCollage };