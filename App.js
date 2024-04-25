/* eslint-disable react/self-closing-comp */
/* eslint-disable react-native/no-inline-styles */
/* eslint-disable no-trailing-spaces */
/* eslint-disable curly */
/* eslint-disable prettier/prettier */
// 'use strict';
import React, {useEffect, Component} from 'react';
import {useRef, useState, useCallback} from 'react';
import {
  SafeAreaView,
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Image,
  Button,
} from 'react-native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {NavigationContainer, useFocusEffect} from '@react-navigation/native';
import {
  StarDeviceDiscoveryManagerFactory,
  InterfaceType,
  StarPrinter,
  StarXpandCommand,
  StarConnectionSettings,
} from 'react-native-star-io10';
import WebView from 'react-native-webview';
import DeviceInfo from 'react-native-device-info';
import {SelectList} from 'react-native-dropdown-select-list';
import axios from 'axios';
import {
  discoverPrinters,
  registerBrotherListener,
  printImage,
  LabelSize,
} from 'react-native-brother-printers';
import ViewShot from 'react-native-view-shot';

// trouve les imprimantes brother sur le reseau
async function setupPrinter() {
  let resolvePrinterPromise;
  const printerPromise = new Promise(resolve => {
    resolvePrinterPromise = resolve;
  });

  await discoverPrinters({});

  await registerBrotherListener('onDiscoverPrinters', printers => {
    if (printers && printers.length > 0) {
      resolvePrinterPromise(printers[0]);
    } else {
      console.error('No printers found');
      resolvePrinterPromise(null);
    }
  });

  const printer = await printerPromise;
  return printer;
}

function initBrotherPrinter(printerFound) {
  // let labelSize = parseInt(printerFound.labelSize,10);
  return {
    'ipAddress':printerFound.ip,
    'modelName':printerFound.serialNumber,
    'labelSize': parseInt(printerFound.ticketSize, 10),
  };
}

const roles = {
  printReceipt: async (itemToPrint, printerToUse, idPrinter, navigation = null, type = null) => {
    await printReceiptStar(printerToUse,idPrinter,itemToPrint);
    return true;
  },
  printTicketPrice: (itemToPrint, printerToUse, idPrinter, navigation = null, type = 'price') => {
    navigation.navigate('Etiquette', {ticket: itemToPrint, printerToUse: printerToUse, idPrinter:idPrinter, type: type});
  },
  printTicketCode: (itemToPrint, printerToUse, idPrinter, navigation = null, type = 'price') => {
    navigation.navigate('Etiquette', {ticket: itemToPrint, printerToUse: printerToUse, idPrinter:idPrinter, type: type});
  },
};

// page pour imprimer l'etiquette
const PriceTicketPage = ({route, navigation}) => {

  const { ticket, printerToUse, idPrinter, type } = route.params;
  const [isPrinting, setIsPrinting] = useState(false);
  
  console.log(type);

  console.log(printerToUse);

  return (
    <View style={styles.webContainer}>
      
      {!isPrinting ?
      <><ViewShot
          ref={e => { this.viewShot = e; } }
          options={{ format: 'jpg', quality: 0.9 }}
        >
          <Text style={{ fontSize: 40, textAlign: 'center' }}>{ticket.companyName}</Text>
          <Text style={{ fontSize: 45, textAlign: 'center' }}>{ticket.nomArticle}</Text>
          {type === 'code' && <Image
            style={styles.image}
            source={{
              uri: ticket.barcodeId,
            }}
          />}
          <Text style={{ fontSize: 70, textAlign: 'center' }}>{ticket.bigPrice}</Text>
          <Text style={{ fontSize: 33, textAlign: 'center' }}>{ticket.data}</Text>
        </ViewShot><TouchableOpacity
          style={styles.buttonContainer}
          onPress={async () => {
            let image = await this.viewShot.capture();
            if (image) {
              await changePrinterState(idPrinter, 1);
              try {
                setIsPrinting(true);
                await printImage(printerToUse, image, {
                  autoCut: true,
                  labelSize: printerToUse.labelSize,
                });
                let finished = await changePrinterState(idPrinter, 0);
                if (finished) {
                  setIsPrinting(false);
                }
              } catch (err) {
                console.error(err);
              }

            }
          } }
        >
            <Text style={styles.buttonText}>Imprimer</Text>
          </TouchableOpacity><TouchableOpacity
            style={styles.buttonContainer}
            onPress={() => { navigation.goBack(); } }
          >
            <Text style={styles.buttonText}>Retour</Text>
          </TouchableOpacity></>
      : <Loading load={true}/>
    }
    </View>
  );
};

const Loading = ({load}) => {
  if (load) {
    return (
      <View style={{flex:1, justifyContent:'center', alignContent:'center'}}>
        <ActivityIndicator size="large" color="#00A3E6" />
      </View>
    );
  }
};

const logoUrl =
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRWCnwr47c8kSEOJgrft2Rr_i3RkStqC93Q-WBdSVaoMQ&s';
const Stack = createNativeStackNavigator();

const getIdDevice = async () => await DeviceInfo.getUniqueId();

function initStarPrinter(id) {
  let params = new StarConnectionSettings();
  params.interfaceType = InterfaceType.Lan;
  params.identifier = id;
  return new StarPrinter(params);
}

function getJsonFromString(s) {
  let match = s.match(/^\{.*?\}/s);

  if (match) {
    let jsonObject = JSON.parse(match[0]);
    return jsonObject;
  } else {
    match = s.match(/\[(.*)\]/s);
    if (match && match[1]) {
      let jsonString = match[0];
      let jsonData = JSON.parse(jsonString);
      return jsonData;
    }
  }

  return [];
}

async function getAvailablePrinterByRole(role) {
  try {
    const response = await axios.get(
      `https://dev.mcbpos.com/Locations/getPrinters/${role}`,
    );
    if (response.data) {
      return getJsonFromString(response.data);
    }
  } catch (err) {
    console.error(err);
  }
}

// state = 0 non | 1 oui
async function changePrinterState(id, newState) {
  try {
    const response = await axios.post(`https://dev.mcbpos.com/Locations/changePrinterState/${id}/${newState}`);
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la requête POST:', error);
    throw error;
  }
}

const clientInformations = [
  'customer',
  'email',
  'number',
  'country',
  'address',
];

const headerInformations = [
  'company_phone',
  'company_address',
  'sale_time',
  'sale_receipt',
];

async function getDevicePrinterHttp() {
  try {
    const idDevice = await getIdDevice();
    const req = await fetch('https://dev.mcbpos.com/Locations/getPrinter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({idDevice: idDevice}),
    });
    if (req.ok) {
      const chaine = await req.text();
      const data = getJsonFromString(chaine);
      console.log(data);
      return data;
    }
  } catch (error) {
    console.error('erreur de la requete', error);
  }
}

const allOk = o => {
  return Object.values(o).every(v => v !== null);
};

function item(i) {
  if (allOk(i)) {
    return `\nArticle: ${i.itemName}\nPrix: ${i.price}\nQté: ${i.quantity}\nTotal: ${i.price}\n`;
  }
  return false;
}

function printItems(items) {
  let blocRetour = !Array.isArray(items) ? item(items) : '';
  if (items.length > 1) {
    items.forEach(i => {
      blocRetour += item(i);
    });
  }
  return blocRetour;
}

async function getPrintersByLocIdHttp(locationId) {
  let data = [];
  try {
    const response = await axios.get(
      `https://dev.mcbpos.com/Locations/getPrintersByLocation/${locationId}`,
    );
    if (response.data) {
      data = getJsonFromString(response.data).map(p => ({
        key: p.printer_id,
        value: `${p.printer_name} - ${p.printer_id}`,
      }));
    }
    return data;
  } catch (err) {
    console.error(err);
    return [];
  }
}

async function getLocationsHttp() {
  try {
    const response = await axios.get(
      'https://dev.mcbpos.com/Locations/getLocations',
    );
    const data = getJsonFromString(response.data).map(loc => ({
      key: loc.location_id,
      value: `${loc.name}`,
    }));
    return data;
  } catch (err) {
    console.error(err);
    return [];
  }
}

const WarningPopUp = ({navigation}) => {
  const [isVisible, setIsVisible] = useState(true);
  return (
    <View style={styles.container}>
      {isVisible && (
        <View style={styles.popup}>
          <Text style={styles.text}>
            Votre appareil n'est connecté à aucune imprimante
          </Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setIsVisible(false)}>
            <Text style={styles.buttonText}>Ok</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.navigate('Printers')}>
            <Text style={styles.buttonText}>Configurer mon appareil</Text>
          </TouchableOpacity>
        </View>
      )}
      {!isVisible && (
        <TouchableOpacity
          style={styles.configurateBtn}
          onPress={() => navigation.navigate('Printers')}>
          <Text style={styles.buttonText}>Configurer mon appareil</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

async function addDevicePrinterLocation(url, data) {
  try {
    const response = await axios.post(url, data);
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la requête POST:', error);
    throw error;
  }
}

const Printers = ({navigation}) => {
  const [locations, setLocations] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [choosedPrinter, setChoosedPrinter] = useState();
  const [selectedLocation, setSelectedLocation] = useState();
  const [idDevice, setIdDevice] = useState();
  const [load, setLoad] = useState(false);

  useEffect(() => {
    async function getId() {
      let id = await getIdDevice();
      setIdDevice(id);
    }

    async function fetch() {
      const locs = await getLocationsHttp();
      setLocations(locs);
    }

    fetch();
    getId();
  }, []);

  return (
    <View style={styles.webContainer}>
      <Text style={styles.headerText}>Identifiant de votre appareil :</Text>
      <Text style={styles.deviceInfoText}>{idDevice}</Text>

      <Text style={styles.headerText}>Choisissez votre location</Text>
      {locations && (
        <View style={styles.selectListContainer}>
          <SelectList
            setSelected={setSelectedLocation}
            data={locations}
            onSelect={async () => {
              if (printers.length > 0) setPrinters([]);

              setLoad(true);

              const printersInLoc = await getPrintersByLocIdHttp(
                selectedLocation,
              );
              const printersOnTheNetwork = await findPrinters(printersInLoc);
              const allPrinters = printersInLoc.concat(printersOnTheNetwork);

              setPrinters(allPrinters);
            }}
          />
        </View>
      )}

      {printers.length > 0 ? (
        <View style={styles.selectListContainer}>
          <Text style={styles.headerText}>Choisissez une imprimante</Text>
          <SelectList
            setSelected={setChoosedPrinter}
            data={printers}
            style={styles.selectList}
            disabledItemStyles={true}
            onSelect={() => console.log(choosedPrinter)}
          />
        </View>
      ) : (
        <Loading load={load} />
      )}

      {choosedPrinter && (
        <KeyboardAvoidingView style={{flex: 1}}>
          <Text style={styles.headerText}>Choisissez une imprimante</Text>
          <TextInput style={styles.input} />
        </KeyboardAvoidingView>
      )}

      <View>
        <TouchableOpacity
          onPress={async () => {
            let res = await addDevicePrinterLocation(
              `https://dev.mcbpos.com/Locations/insertLocPrinterDevice/${selectedLocation}/${idDevice}/0011621DFAA5`,
              {},
            );
            console.log(res);
          }}
          style={styles.buttonContainer}>
          <Text style={styles.buttonText}>Enregistrer les données</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.buttonContainer}
          onPress={() => navigation.navigate('Home')}>
          <Text style={styles.buttonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const Home = ({navigation}) => {
  const webRef = useRef(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const handleNavigationStateChange = navState => {
    console.log(`Url en cours : ${navState.url}`);
  };

  const onWebViewMessage = async event => {
    const data = JSON.parse(event.nativeEvent.data);

    if (data.type === 'printButtonClicked') {
      console.log(data.action);
      let printerFound = (await getAvailablePrinterByRole(data.action))[0];
      let printerToUse;
      console.log(printerFound);
      if (printerFound && parseInt(printerFound.isPrinting, 10) === 0) {
        if (printerFound.modele === 'star') {
          printerToUse = initStarPrinter(printerFound.serialNumber);
          setIsPrinting(true);
        } else {
          printerToUse = initBrotherPrinter(printerFound);
        }

        console.log(data.action);

        let finished = await roles[data.action](data.item, printerToUse, printerFound.id, navigation, data.ticket);

        if (finished) {
          setIsPrinting(false);
        }
      }
    }

    if (data.type === 'openDrawer') {
      openCashDrawer();
    }
  };

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: 'white'}}>
      {!isPrinting ? <WebView
        style={styles.webView}
        source={{uri: 'https://dev.mcbpos.com/dev4dev4'}}
        onNavigationStateChange={handleNavigationStateChange}
        javaScriptEnabled={true}
        ref={webRef}
        onMessage={onWebViewMessage}
      /> : <Loading load={true} /> }
    </SafeAreaView>
  );
};

function printInfo(o, data) {
  let contenu = '\n';

  if (Object.keys(data).length === 0) return '';

  Object.keys(o).forEach(k => {
    if (data.includes(k)) {
      if (o[k]) contenu += `${o[k]}\n`;
    }
  });

  return contenu;
}

async function printLogo(printer) {
  let builder = new StarXpandCommand.StarXpandCommandBuilder();
  builder.addDocument(
    new StarXpandCommand.DocumentBuilder().addPrinter(
      new StarXpandCommand.PrinterBuilder()
        .styleAlignment(StarXpandCommand.Printer.Alignment.Center)
        .actionPrintImage(
          new StarXpandCommand.Printer.ImageParameter(logoUrl, 300),
        )
        .actionPrintText('\n'),
    ),
  );

  let commands = await builder.getCommands();
  await handlePrinter(printer, commands);
}

function printIfNotNull(champ, data) {
  return !data ? '' : `${champ} : ${data}\n`;
}

async function printReceiptStar(printer, idPrinter, receipt = null) {
  let client = {};
  if (receipt.client) {
    client = receipt.client;
  }
  await changePrinterState(idPrinter,1);

  try {
    let builder = new StarXpandCommand.StarXpandCommandBuilder();
    builder.addDocument(
      new StarXpandCommand.DocumentBuilder().addPrinter(
        new StarXpandCommand.PrinterBuilder()
          .styleAlignment(StarXpandCommand.Printer.Alignment.Center)
          .actionPrintText(`${receipt.company_name}\n`)
          .styleInternationalCharacter(
            StarXpandCommand.Printer.InternationalCharacterType.Usa,
          )
          .styleCharacterSpace(0)
          .styleAlignment(StarXpandCommand.Printer.Alignment.Center)
          .actionPrintText('\n')
          .actionPrintText(printInfo(receipt, headerInformations))
          .styleAlignment(StarXpandCommand.Printer.Alignment.Left)
          .actionPrintText(printInfo(client, clientInformations))
          .actionPrintText(
            `${receipt.sale_id}\n` +
              `${receipt.employee}\n` +
              printItems(receipt.item) +
              '---------------------------------------------\n',
          )
          .styleAlignment(StarXpandCommand.Printer.Alignment.Right)
          .actionPrintText(
            printIfNotNull('Sous-total', receipt.subTotal) +
              printIfNotNull('Taxes', receipt.taxe),
          )
          .actionPrintText(
            printIfNotNull('Total', receipt.withTaxes) +
              'Type de paiement : ' +
              printIfNotNull('', receipt.paymentType) +
              printIfNotNull('Montant due', receipt.due) +
              printIfNotNull('Solde du compte client', receipt.given) +
              '\n',
          )
          .styleAlignment(StarXpandCommand.Printer.Alignment.Center)
          .actionPrintText('owo \n')
          .actionPrintImage(
            new StarXpandCommand.Printer.ImageParameter(receipt.barCode, 250),
          )
          .actionCut(StarXpandCommand.Printer.CutType.Partial),
      ),
    );

    let commands = await builder.getCommands();
    await handlePrinter(printer, commands);

    if (receipt.paymentType === 'Comptant') {
      await openCashDrawer();
    }

    await changePrinterState(idPrinter,0);

    await printLogo(printer);
    console.log('ok');
  } catch (error) {
    console.error('error : ', error);
  }
}
// star
async function handlePrinter(printer, commands) {
  await printer.open();
  await printer.print(commands);

  await printer.close();
  await printer.dispose();
}

async function openCashDrawer(printer) {
  try {
    var builder = new StarXpandCommand.StarXpandCommandBuilder();
    builder.addDocument(
      new StarXpandCommand.DocumentBuilder().addDrawer(
        new StarXpandCommand.DrawerBuilder().actionOpen(
          new StarXpandCommand.Drawer.OpenParameter().setChannel(
            StarXpandCommand.Drawer.Channel.No1,
          ),
        ),
      ),
    );

    let commands = await builder.getCommands();
    await handlePrinter(printer, commands);
  } catch (err) {
    console.error(err);
  }
}

function containsPrinter(ps, id) {
  for (const pr in ps) {
    if (ps[pr].key === id) return true;
  }
  return false;
}

// affiche les identifiants des imprimantes STAR connectees sur le reseaux
async function findPrinters() {
  return new Promise((resolve, reject) => {
    StarDeviceDiscoveryManagerFactory.create([InterfaceType.Lan])
      .then(managerResearch => {
        managerResearch.discoveryTime = 2000;
        managerResearch.onPrinterFound = p => {
          console.log(p.connectionSettings);
        };
        managerResearch.onDiscoveryFinished = () => {
          console.log('fini');
        };
        return managerResearch.startDiscovery();
      })
      .catch(error => {
        reject(error);
      });
  });
}

function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen
          name="Home"
          component={Home}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="Etiquette"
          component={PriceTicketPage}
          options={{headerShown: false}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    elevation: 4,
    borderRadius: 10,
  },
  webContainer: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
  },
  text: {
    fontSize: 16,
    color: '#333',
    marginVertical: 10,
  },
  webView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  popup: {
    position: 'absolute',
    bottom: '10%',
    left: '10%',
    right: '10%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    alignItems: 'center',
  },
  closeButton: {
    fontSize: 14,
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
    backgroundColor: '#00A3E6',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  configurateBtn: {
    top: '45%',
    backgroundColor: '#00A3E6',
    padding: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  deviceInfoText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 20,
  },
  selectListContainer: {
    marginBottom: 20,
  },
  buttonContainer: {
    backgroundColor: '#00A3E6',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 30,
    shadowOffset: {width: 1, height: 1},
    shadowOpacity: 0.3,
    marginVertical: 10,
    width: 250,
    marginTop: 15,
  },
  input: {
    height: 40,
    margin: 12,
    borderWidth: 1,
    padding: 10,
  },
  captureArea: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: 'white',
  },
  viewShotContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    height: 200,
  },
});

export default App;
