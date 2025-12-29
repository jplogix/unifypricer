import { Router } from 'express';
import { OAuthController } from './oauth-controller';

export const oauthRouter = Router();
const oauthController = new OAuthController();

// Shopify OAuth routes
oauthRouter.get('/shopify/initiate', oauthController.initiateShopifyOAuth);
oauthRouter.get('/shopify/callback', oauthController.handleShopifyCallback);
oauthRouter.get('/shopify/poll', oauthController.pollShopifyOAuthResult);

// WooCommerce OAuth routes
oauthRouter.get('/woocommerce/initiate', oauthController.initiateWooCommerceOAuth);
oauthRouter.get('/woocommerce/callback', oauthController.handleWooCommerceCallback);

// WooCommerce token-based connection routes (simplified plugin)
oauthRouter.get('/woocommerce/generate-token', oauthController.generateConnectionToken);
oauthRouter.post('/woocommerce/connect', (req, res) => oauthController.connectWooCommerce(req, res));
