/**
 * Typesafe translation keys for the Product scope.
 * Generated from standardized translation sections (base, enums, commands, validations).
 *
 * Usage:
 *   transloco.translate(PRODUCT_KEYS.base.table.columns.sku)
 *   // => 'product.base.table.columns.sku'
 */
export const PRODUCT_KEYS = {
  base: {
    tabs: {
      products: 'product.base.tabs.products',
      multimedia: 'product.base.tabs.multimedia',
      salesOffer: 'product.base.tabs.salesOffer',
      warranties: 'product.base.tabs.warranties',
    },
    table: {
      columns: {
        sku: 'product.base.table.columns.sku',
        name: 'product.base.table.columns.name',
        category: 'product.base.table.columns.category',
        modelName: 'product.base.table.columns.modelName',
        price: 'product.base.table.columns.price',
        availableFrom: 'product.base.table.columns.availableFrom',
        status: 'product.base.table.columns.status',
        available: 'product.base.table.columns.available',
      },
      emptyMessage: 'product.base.table.emptyMessage',
    },
  },
  enums: {
    status: {
      active: 'product.enums.status.active',
      draft: 'product.enums.status.draft',
      withdrawn: 'product.enums.status.withdrawn',
      archive: 'product.enums.status.archive',
    },
  },
  commands: {
    setPrice: {
      label: 'product.commands.setPrice.label',
      modalTitle: 'product.commands.setPrice.modalTitle',
      priceLabel: 'product.commands.setPrice.priceLabel',
      submitButton: 'product.commands.setPrice.submitButton',
      cancelButton: 'product.commands.setPrice.cancelButton',
      editMessage: 'product.commands.setPrice.editMessage',
      productSuffixSingle: 'product.commands.setPrice.productSuffixSingle',
      productSuffixPlural: 'product.commands.setPrice.productSuffixPlural',
    },
  },
  validations: {
    priceRequired: 'product.validations.priceRequired',
    priceMin: 'product.validations.priceMin',
  },
} as const;
