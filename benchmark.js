const fs = require('fs');
import csvtojson from 'csvtojson';
//import {gqlInsert, gql} from './lib/gql-helper';
import {GraphQLClient, gql} from 'graphql-request';
import config from './config';

/*
yarn prepare: it should 
    1. insert all the references
    2. copy the existing dataset and replace the values with references

For insert main record test we should use armory
 */
class Benchmark {
  constructor(cms) {
    this.cms = cms;

    this.countries = {};
    this.itemTypes = {};
    this.orderPriorities = {};
    this.regions = {};
    this.salesChannels = {};
  }

  /**
   * Prepare data loops through the whole dataset and extracts the individual unique
   * records for countries, item types, order priorities, regions and sales channels.
   * Once the records have been extracted, they are populated inside individual
   * variables and the import functions are then called.
   */
  async prepareData(records) {
    console.log('PREPARE OPERATION RUNNING');

    // check if we previously imported the reference modules
    this._importReferences();

    // open the file for prep
    const testSetStream = fs.createWriteStream('./tmp/prepared-records.csv', {
      flags: 'a', // 'a' means appending (old data will be preserved)
    });
    // write the headers into the test set
    testSetStream.write(
      'Region,Country,Item Type,Sales Channel,Order Priority,Order Date,Order ID,Ship Date,Units Sold,Unit Price,Unit Cost,Total Revenue,Total Cost,Total Profit'
    );

    // loop through all the records and create the references in the headless cms
    for (const entry of records) {
      let regionName = entry['Region'];
      if (!this.regions.hasOwnProperty(entry['Region'])) {
        const regionId = await this.importRegion(entry['Region']);
        this.regions[entry['Region']] = regionId;
      }
      entry['Region'] = this.regions[entry['Region']];

      // it's important this happens after the region import call
      if (!this.countries.hasOwnProperty(entry['Country'])) {
        const countryId = await this.importCountry(
          entry['Country'],
          this.regions[regionName]
        );
        this.countries[entry['Country']] = countryId;
      }
      entry['Country'] = this.countries[entry['Country']];

      if (!this.itemTypes.hasOwnProperty(entry['Item Type'])) {
        const itemTypeId = await this.importItemType(entry['Item Type']);
        this.itemTypes[entry['Item Type']] = itemTypeId;
      }
      entry['Item Type'] = this.itemTypes[entry['Item Type']];

      if (!this.salesChannels.hasOwnProperty(entry['Sales Channel'])) {
        const salesChannelId = await this.importSalesChannel(
          entry['Sales Channel']
        );
        this.salesChannels[entry['Sales Channel']] = salesChannelId;
      }
      entry['Sales Channel'] = this.salesChannels[entry['Sales Channel']];

      if (!this.orderPriorities.hasOwnProperty(entry['Order Priority'])) {
        const orderPriorityId = await this.importOrderPriority(
          entry['Order Priority']
        );
        this.orderPriorities[entry['Order Priority']] = orderPriorityId;
      }
      entry['Order Priority'] = this.orderPriorities[entry['Order Priority']];

      // cast other types to right format
      entry['Order Date'] = new Date(entry['Order Date'])
        .toISOString()
        .substr(0, 10);
      entry['Ship Date'] = new Date(entry['Ship Date'])
        .toISOString()
        .substr(0, 10);

      // write the full line into the test set
      testSetStream.write('\n' + this._entryToCSV(entry));

      // update the references file
      this._exportReferences();
    }

    // close the test set stream
    testSetStream.end();

    console.log('PREPARE OPERATION FINISHED');
  }

  async runBenchmark(records) {
    let i = 1;
    for (const entry of records) {
      console.log('Importing order: ' + i);

      const mutation = gql`
      mutation {
        createOrder(data: 
          {
            orderId: ${entry['Order ID']},
            orderDate: "${entry['Order Date']}",
            shippingDate: "${entry['Ship Date']}",
            unitsSold: ${entry['Units Sold']},
            unitPrice: ${entry['Unit Price']},
            totalPrice: ${entry['Total Revenue']},
            country: {
              modelId: "country",
              entryId: "${entry['Country']}"
            },
            itemType: {
              modelId: "itemType",
              entryId: "${entry['Item Type']}"
            },
            salesChannel: {
              modelId: "salesChannel",
              entryId: "${entry['Sales Channel']}"
            },
            orderPriority: {
              modelId: "orderPriority",
              entryId: "${entry['Order Priority']}"
            },
          }) {
          data {
            id
          }
          error {
            message
          }
        }
      }
    `;
      try {
        const result = await this._gqlRequest(mutation);
        console.log('Imported order ' + i + ' successfully');
        i++;
      } catch (error) {
        console.log(error);
        process.exit();
      }
    }
  }

  async importCountry(countryName, regionId) {
    console.log('Importing country: ' + countryName);

    const mutation = gql`
      mutation {
        createCountry(data: 
          {
            name: "${countryName}",
            region: {
              modelId: "region",
              entryId: "${regionId}"
            }
          }) {
          data {
            id
          }
          error {
            message
          }
        }
      }
    `;
    try {
      const result = await this._gqlRequest(mutation);
      const id = result.createCountry.data.id;
      console.log('Importing country: ' + countryName + ' successful - ' + id);
      return id;
    } catch (error) {
      console.log(error);
      process.exit();
    }
  }

  async importItemType(itemTypeName) {
    console.log('Importing item type: ' + itemTypeName);
    const mutation = gql`
      mutation {
        createItemType(data: {name: "${itemTypeName}"}) {
          data {
            id
          }
          error {
            message
          }
        }
      }
    `;
    try {
      const result = await this._gqlRequest(mutation);
      const id = result.createItemType.data.id;
      console.log(
        'Importing item type: ' + itemTypeName + ' successful - ' + id
      );
      return id;
    } catch (error) {
      console.log(error);
      process.exit();
    }
  }

  async importOrderPriority(orderPriorityName) {
    console.log('Importing order priority: ' + orderPriorityName);
    const mutation = gql`
      mutation {
        createOrderPriority(data: {priority: "${orderPriorityName}"}) {
          data {
            id
          }
          error {
            message
          }
        }
      }
    `;
    try {
      const result = await this._gqlRequest(mutation);
      const id = result.createOrderPriority.data.id;
      console.log(
        'Importing order priority: ' + orderPriorityName + ' successful - ' + id
      );
      return id;
    } catch (error) {
      console.log(error);
      process.exit();
    }
  }

  async importRegion(regionName) {
    console.log('Importing region: ' + regionName);
    const mutation = gql`
      mutation {
        createRegion(data: {name: "${regionName}"}) {
          data {
            id
          }
          error {
            message
          }
        }
      }
    `;
    try {
      const result = await this._gqlRequest(mutation);
      const id = result.createRegion.data.id;
      console.log('Importing region: ' + regionName + ' successful - ' + id);
      return id;
    } catch (error) {
      console.log(error);
      process.exit();
    }
  }

  async importSalesChannel(saleChannelName) {
    console.log('Importing sales channel: ' + saleChannelName);
    const saleChannelNameEnum = saleChannelName.toLowerCase();
    const mutation = gql`
      mutation {
        createSalesChannel(data: {type: "${saleChannelNameEnum}"}) {
          data {
            id
          }
          error {
            message
          }
        }
      }
    `;
    try {
      const result = await this._gqlRequest(mutation);
      const id = result.createSalesChannel.data.id;
      console.log(
        'Importing sales channel: ' + saleChannelName + ' successful - ' + id
      );
      return id;
    } catch (error) {
      console.log(error);
      process.exit();
    }
  }

  _debug(msg) {
    if (config.debug) {
      console.log(msg);
    }
  }

  async _gqlRequest(request) {
    const client = new GraphQLClient(config.webiny.manageApi, {
      headers: {
        authorization: 'Bearer ' + config.webiny.authToken,
      },
    });

    return await client.request(request);
  }

  _entryToCSV(entry) {
    let values = [];
    for (const [key, value] of Object.entries(entry)) {
      values.push(value);
    }

    return values.join(',');
  }

  _importReferences() {
    const referencesFile = './tmp/references.json';
    if (fs.existsSync(referencesFile)) {
      // populate the references
      let rawdata = fs.readFileSync(referencesFile);
      let references = JSON.parse(rawdata);

      this.countries = references.countries;
      this.itemTypes = references.itemTypes;
      this.orderPriorities = references.orderPriorities;
      this.regions = references.regions;
      this.salesChannels = references.salesChannels;
    }
  }

  _exportReferences() {
    const referencesFile = './tmp/references.json';
    const references = JSON.stringify(
      {
        countries: this.countries,
        itemTypes: this.itemTypes,
        orderPriorities: this.orderPriorities,
        regions: this.regions,
        salesChannels: this.salesChannels,
      },
      null,
      2
    );
    fs.writeFileSync(referencesFile, references);
  }
}

(async () => {
  if (
    process.argv.indexOf('--prepare') < 1 &&
    process.argv.indexOf('--benchmark') < 1
  ) {
    console.log('You need to pass either --prepare or --benchmark arguments');
    process.exit();
  }

  // benchmark
  const b = new Benchmark('webiny');

  if (process.argv.indexOf('--prepare') > 0) {
    // extract the records from the csv
    const records = await csvtojson.csv().fromFile(config.dataSet);

    await b.prepareData(records);
  } else if (process.argv.indexOf('--benchmark') > 0) {
    const preparedRecordsFile = './tmp/prepared-records.csv';
    // extract the prepared records from the csv
    if (!fs.existsSync(preparedRecordsFile)) {
      console.log(
        'Before you can run the benchmark you need to run the prepare operation.'
      );
      process.exit();
    }
    const records = await csvtojson.csv().fromFile(preparedRecordsFile);

    await b.runBenchmark(records);
  }
})();
