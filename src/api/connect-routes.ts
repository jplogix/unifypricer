import { Router } from 'express';
import { OAuthController } from './oauth-controller';

export const connectRouter = Router();
const oauthController = new OAuthController();

// WooCommerce connection endpoint for the simplified plugin
connectRouter.post('/woocommerce', (req, res) => oauthController.connectWooCommerce(req, res));
