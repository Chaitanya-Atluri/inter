const express = require('express')
const router = express.Router()
const Movie = require('../models/movie')
const Genre = require('../models/genre')
const imageMimeTypes = ['image/jpeg', 'image/png', 'images/gif']

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
  if (coverEncoded == null) return
  {
  const cover = JSON.parse(coverEncoded)
  console.log(cover)
  }
  if (cover != null && imageMimeTypes.includes(cover.type)) {
    movie.coverImage = new Buffer.from(cover.data, 'base64')
    movie.coverImageType = cover.type
  }
}

module.exports = router