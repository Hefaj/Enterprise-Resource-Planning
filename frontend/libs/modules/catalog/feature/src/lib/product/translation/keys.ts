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
    filters: {
      sku: {
        label: 'product.base.filters.sku.label',
        placeholder: 'product.base.filters.sku.placeholder',
      },
      name: {
        label: 'product.base.filters.name.label',
        placeholder: 'product.base.filters.name.placeholder',
      },
      price: {
        label: 'product.base.filters.price.label',
        placeholder: 'product.base.filters.price.placeholder',
      },
      availableFrom: {
        label: 'product.base.filters.availableFrom.label',
        placeholder: 'product.base.filters.availableFrom.placeholder',
      },
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
    multimedia: {
      gallery: {
        title: 'product.base.multimedia.gallery.title',
        subtitle: 'product.base.multimedia.gallery.subtitle',
        description: 'product.base.multimedia.gallery.description',
      },
      video: {
        title: 'product.base.multimedia.video.title',
        subtitle: 'product.base.multimedia.video.subtitle',
        description: 'product.base.multimedia.video.description',
      },
    },
    delivery: {
      shipping: {
        title: 'product.base.delivery.shipping.title',
        subtitle: 'product.base.delivery.shipping.subtitle',
        description: 'product.base.delivery.shipping.description',
      },
      packing: {
        title: 'product.base.delivery.packing.title',
        subtitle: 'product.base.delivery.packing.subtitle',
        description: 'product.base.delivery.packing.description',
      },
    },
    exclusion: {
      title: 'product.base.exclusion.title',
      subtitle: 'product.base.exclusion.subtitle',
      description: 'product.base.exclusion.description',
    },
    salesOffer: {
      tabs: {
        exclusion: 'product.base.salesOffer.tabs.exclusion',
        delivery: 'product.base.salesOffer.tabs.delivery',
      },
    },
    warranty: {
      terms: {
        title: 'product.base.warranty.terms.title',
        subtitle: 'product.base.warranty.terms.subtitle',
        description: 'product.base.warranty.terms.description',
      },
      service: {
        title: 'product.base.warranty.service.title',
        subtitle: 'product.base.warranty.service.subtitle',
        description: 'product.base.warranty.service.description',
      },
      steps: {
        terms: 'product.base.warranty.steps.terms',
        service: 'product.base.warranty.steps.service',
      },
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
