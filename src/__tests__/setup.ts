process.env.JWT_SECRET = 'test_secret_key_gruas_del_norte'
process.env.PORT = '0'
// Firebase y Redis no se inicializan en tests
process.env.FIREBASE_CREDENTIALS_PATH = ''
process.env.REDIS_URL = ''
