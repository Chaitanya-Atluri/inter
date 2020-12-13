const express = require('express')
const mongodb = require('mongodb');	
const fs = require("fs");	
const router = express.Router()
const Movie = require('../models/movie')
const Genre = require('../models/genre')
const imageMimeTypes = ['image/jpeg', 'image/png', 'images/gif']
const url = 'mongodb://localhost:27017/vidplayer';
// All Movies Route
router.get('/', async (req, res) => {
  let query = Movie.find()
  if (req.query.title != null && req.query.title != '') {
    query = query.regex('title', new RegExp(req.query.title, 'i'))
  }
  if (req.query.releaseedBefore != null && req.query.releaseedBefore != '') {
    query = query.lte('releaseDate', req.query.releaseedBefore)
  }
  if (req.query.releaseedAfter != null && req.query.releaseedAfter != '') {
    query = query.gte('releaseDate', req.query.releaseedAfter)
  }
  try {
    const movies = await query.exec()
    res.render('movies/index', {
      movies: movies,
      searchOptions: req.query
    })
  } catch {
    res.redirect('/')
  }
})

// New Movie Route
router.get('/new', async (req, res) => {
  renderNewPage(res, new Movie())
})

// Create Movie Route
router.post('/', async (req, res) => {
  const movie = new Movie({
    title: req.body.title,
    genre: req.body.genre,
    releaseDate: new Date(req.body.releaseDate),
    description: req.body.description
  })
  saveCover(movie, req.body.cover)
mongodb.MongoClient.connect(url, function (error, client) {
    if (error) {
      res.status(500).json(error);
      return;
    }
	const db = client.db('vidplayer');
    const bucket = new mongodb.GridFSBucket(db);
    const videoUploadStream = bucket.openUploadStream(req.body.title);
    const videoReadStream = fs.createReadStream('./public/video/bigbuck.mp4');
	videoReadStream.pipe(videoUploadStream);
	console.log("upload success")

});
  try {
    const newMovie = await movie.save()
    res.redirect(`movies/${newMovie.id}`)
  } catch {
    renderNewPage(res, movie, true)
  }
})

// Show Movie Route
router.get('/:id', async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id)
                           .populate('genre')
                           .exec()
    res.render('movies/show', { movie: movie })
  } catch {
    res.redirect('/')
  }
})
//play route
router.get('/:id/play', async (req, res) => {
	try {
    const movie = await Movie.findById(req.params.id)
    res.render('movies/play', { movie: movie })
  } catch {
    res.redirect('/')
  }
})
//play helper route
router.get("/:id/play/mongo-video", function (req, res) {
mongodb.MongoClient.connect(url, function (error, client) {
    if (error) {
      res.status(500).json(error);
      return;
    }
	console.log("conneted to retrieve")
	const db = client.db('vidplayer');
    const range = req.headers.range;
    if (!range) {
      res.status(400).send("Requires Range header");
    }

    db.collection('fs.files').findOne({}, (err, video) => {
      if (!video) {
        res.status(404).send("No video uploaded!");
        return;
      }
      // Create response headers
      const videoSize = video.length;
      const start = Number(range.replace(/\D/g, ""));
      const end = videoSize - 1;

      const contentLength = end - start + 1;
      const headers = {
        "Content-Range": `bytes ${start}-${end}/${videoSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": contentLength,
        "Content-Type": "video/mp4",
      };

      // HTTP Status 206 for Partial Content
      res.writeHead(206, headers);

      const bucket = new mongodb.GridFSBucket(db);
      const downloadStream = bucket.openDownloadStreamByName('bigbuck', {
        start
      });

      // Finally pipe video to response
      downloadStream.pipe(res);
    });
  });
});

// Edit Movie Route
router.get('/:id/edit', async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id)
    renderEditPage(res, movie)
  } catch {
    res.redirect('/')
  }
})

// Update Movie Route
router.put('/:id', async (req, res) => {
  let movie

  try {
    movie = await Movie.findById(req.params.id)
    movie.title = req.body.title
    movie.genre = req.body.genre
    movie.releaseDate = new Date(req.body.releaseDate)
    movie.description = req.body.description
    if (req.body.cover != null && req.body.cover !== '') {
      saveCover(movie, req.body.cover)
    }
    await movie.save()
    res.redirect(`/movies/${movie.id}`)
  } catch {
    if (movie != null) {
      renderEditPage(res, movie, true)
    } else {
      redirect('/')
    }
  }
})

// Delete Movie Page
router.delete('/:id', async (req, res) => {
  let movie
  try {
    movie = await Movie.findById(req.params.id)
    await movie.remove()
    res.redirect('/movies')
  } catch {
    if (movie != null) {
      res.render('movies/show', {
        movie: movie,
        errorMessage: 'Could not remove movie'
      })
    } else {
      res.redirect('/')
    }
  }
})

async function renderNewPage(res, movie, hasError = false) {
  renderFormPage(res, movie, 'new', hasError)
}

async function renderEditPage(res, movie, hasError = false) {
  renderFormPage(res, movie, 'edit', hasError)
}

async function renderFormPage(res, movie, form, hasError = false) {
  try {
    const genres = await Genre.find({})
    const params = {
      genres: genres,
      movie: movie
    }
    if (hasError) {
      if (form === 'edit') {
        params.errorMessage = 'Error Updating Movie'
      } else {
        params.errorMessage = 'Error Creating Movie'
      }
    }
    res.render(`movies/${form}`, params)
  } catch {
    res.redirect('/movies')
  }
}

function saveCover(movie, coverEncoded) {
  const cover = JSON.parse(coverEncoded)

  if (cover != null && imageMimeTypes.includes(cover.type)) {
    movie.coverImage = new Buffer.from(cover.data, 'base64')
    movie.coverImageType = cover.type
  }
}

module.exports = router