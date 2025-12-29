# Configuration Guide

This guide explains how to configure stores in the Price Sync Dashboard.

## Overview

The dashboard supports monitoring and syncing prices for:
- **WooCommerce**
- **Shopify**

Currently, store configuration is managed via the API. Future versions will support full UI management.

## Managing Stores via API

You can use `curl`, Postman, or the Dashboard UI (if implemented) to add stores.

### 1. WooCommerce

**Requirements:**
- Store URL
- Consumer Key (Read/Write access)
- Consumer Secret

**Payload:**
```json
{
  "storeId": "woo-001",
  "storeName": "My WooCommerce Store",
  "platform": "woocommerce",
  "syncInterval": 60,
  "credentials": {
    "url": "https://mystore.com",
    "consumerKey": "ck_...",
    "consumerSecret": "cs_..."
  }
}
```

### 2. Shopify

**Requirements:**
- Store Domain (e.g., `mystore.myshopify.com`)
- Access Token (Admin API Access Token with `write_products` scope)

**Payload:**
```json
{
  "storeId": "shopify-001",
  "storeName": "My Shopify Store",
  "platform": "shopify",
  "syncInterval": 60,
  "credentials": {
    "shopName": "mystore.myshopify.com",
    "accessToken": "shpat_..."
  }
}
```

### API Endpoints

- **Add Store**: `POST /api/stores`
- **List Stores**: `GET /api/stores`
- **Delete Store**: `DELETE /api/stores/:storeId`

## Security

- **Encryption**: All credentials (`consumerSecret`, `accessToken`) are encrypted at rest using AES-256-GCM.
- **Key Management**: The encryption key is defined in the `ENCRYPTION_KEY` environment variable. 
  - **WARNING**: If you change the `ENCRYPTION_KEY`, all existing stored credentials will become unreadable. Back up your database before rotating keys.

## Sync Configuration

- **syncInterval**: The interval in minutes between automatic syncs. 
  - Default: `60` (1 hour).
  - Minimum recommended: `10`.
