import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

const jar = new CookieJar();

export const http = wrapper(axios.create({
	jar,
	withCredentials: true,
	baseURL: 'https://publico.oefa.gob.pe',
	decompress: false,
	headers: {
		'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
		'Content-Type': 'application/x-www-form-urlencoded',
	},
} as any));