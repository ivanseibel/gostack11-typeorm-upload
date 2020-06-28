import path from 'path';
import multer from 'multer';
import crypto from 'crypto';

const tmpDir = path.resolve(__dirname, '..', '..', 'tmp');

export default {
  tmpDir,
  storage: multer.diskStorage({
    destination: tmpDir,
    filename(request, file, callback) {
      const fileHash = crypto.randomBytes(10).toString('hex');
      const fileName = `${fileHash} - ${file.originalname}`;
      return callback(null, fileName);
    },
  }),
};
