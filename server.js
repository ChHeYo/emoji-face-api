const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const knex = require('knex');
const bcrypt = require('bcrypt');

const db = knex({
    client: 'pg',
    connection: {
        connectionString: process.env.DATABASE_URL,
        ssl: true,
    }
});

const app = express();

app.use(bodyParser.json());
app.use(cors());;

app.get('/', (req, res) => {
    res.json('hello');
})

app.post('/signin', (req, res) => {
    if (!req.body.email || !req.body.password){
        return res.status(400).json('Incorrect form submission');
    }
    db.select('email', 'hash').from('login')
    .where('email', '=', req.body.email)
    .then(data => {
        const isValid = bcrypt.compareSync(req.body.password, data[0].hash);
        if (isValid) {
            db.select('*').from('users')
            .where('email', '=', req.body.email)
            .then(user => {
                res.json(user[0])
            })
            .catch(err => res.status(400).json('unable to get user'))
        } else {
            res.status(400).json('wrong credentials')
        }
    })
    .catch(err => res.status(400).json('wrong credentials'))
})

app.post('/register', (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
        return res.status(400).json('Incorrect form submission');
    }
    const hash = bcrypt.hashSync(password, 10);
    db.transaction(trx => {
        trx.insert({
            email: email,
            name: name,
            joined: new Date()
        })
        .into('users')
        .returning('email')
        .then(loginEmail => {
            return trx('login')
            .insert({
                hash: hash,
                email: email
            })
            .returning('*')
            .then(user => {
                db.select('*').from('users').where({
                    email: user[0].email
                })
                .then(userInfo => {
                    res.json(userInfo[0]);
                })
            })
        })
        .then(trx.commit)
        .catch(trx.rollback)
    })
    .catch(err => {
        res.status(400).json("Unable to register");
    })
})

app.get('/profile/:id', (req, res) => {
    const { id } = req.params;
    db.select('*').from('users').where({
        id: id
    })
    .then(user => {
        if(user.length){
            res.json(user[0]);
        } else {
            res.status(400).json('User not found');
        }
    })
    .catch(err => {
        res.status(400).json("User not found");
    })
})

app.put('/image', (req, res) => {
    const { id } = req.body;
    db('users').where('id', '=', id)
    .increment('entries', 1)
    .returning('entries')
    .then(entries => {
        res.json(entries[0]);
    })
    .catch(err => {
        res.status(400).json("No entries found");
    })
})

const PORT = process.env.PORT
app.listen(PORT, () => {
    console.log(`App is running on port ${PORT}`);
})

/*
API design

/ => res => this is working
/signin => POST => success/fail
/register => POST = user
/profile/:userID => GET => user
/image --> PUT --> user

*/