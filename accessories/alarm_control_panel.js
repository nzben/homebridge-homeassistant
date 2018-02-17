'use strict';

let Service;
let Characteristic;
let communicationError;

function HomeAssistantAlarmControlPanel(log, data, client, firmware) {
  this.data = data;
  this.domain = 'alarm_control_panel';
  this.entity_id = data.entity_id;
  this.uuid_base = data.entity_id;

  this.manufacturer = 'Home Assistant';
  this.model = 'Alarm Control Panel';
  this.name = data.entity_id.split('.').pop().replace(/_/g, ' ');
  this.serial = data.entity_id;
  this.firmware = firmware;

  if (data.attributes.homebridge_manufacturer) {
    this.manufacturer = String(data.attributes.homebridge_manufacturer);
  }

  if (data.attributes.homebridge_model) {
    this.model = String(data.attributes.homebridge_model);
  }

  if (data.attributes.friendly_name) {
    this.name = data.attributes.friendly_name;
  }

  if (data.attributes.homebridge_serial) {
    this.serial = String(data.attributes.homebridge_serial);
  }

  this.client = client;
  this.log = log;

  this.alarmCode = data.attributes.homebridge_alarm_code;

  // SecuritySystemCurrentState
  this.currentStayArm = Characteristic.SecuritySystemCurrentState.STAY_ARM; // 0
  this.currentAwayArm = Characteristic.SecuritySystemCurrentState.AWAY_ARM; // 1
  this.currentNightArm = Characteristic.SecuritySystemCurrentState.NIGHT_ARM; // 2
  this.currentDisarmed = Characteristic.SecuritySystemCurrentState.DISARMED; // 3
  this.currentTriggered = Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED; // 4

  // SecuritySystemTargetState
  this.targetStayArm = Characteristic.SecuritySystemTargetState.STAY_ARM; // 0
  this.targetAwayArm = Characteristic.SecuritySystemTargetState.AWAY_ARM; // 1
  this.targetNightArm = Characteristic.SecuritySystemTargetState.NIGHT_ARM; // 2
  this.targetDisarm = Characteristic.SecuritySystemTargetState.DISARM; // 3

  // StatusFault
  this.noFault = Characteristic.StatusFault.NO_FAULT; // 0
  this.generalFault = Characteristic.StatusFault.GENERAL_FAULT; // 1

  // StatusTampered
  this.notTampered = Characteristic.StatusTampered.NOT_TAMPERED; // 0
  this.tampered = Characteristic.StatusTampered.TAMPERED; // 1
}

HomeAssistantAlarmControlPanel.prototype = {
  onEvent(oldState, newState) {
    let currentState;
    switch (newState.state) {
      case 'armed_home':
        currentState = this.currentStayArm;
        break;
      case 'armed_away':
        currentState = this.currentAwayArm;
        break;
      case 'armed_night':
        currentState = this.currentNightArm;
        break;
      case 'disarmed':
        currentState = this.currentDisarmed;
        break;
      case 'triggered':
        currentState = this.currentTriggered;
        break;
      default:
        currentState = this.currentDisarmed;
        break;
    }
    this.securitySystemService.getCharacteristic(Characteristic.SecuritySystemCurrentState)
      .setValue(currentState, null, 'internal');

    let targetState;
    switch (newState.state) {
      case 'armed_home':
        targetState = this.targetStayArm;
        break;
      case 'armed_away':
        targetState = this.targetAwayArm;
        break;
      case 'armed_night':
        targetState = this.targetNightArm;
        break;
      case 'disarmed':
        targetState = this.targetDisarm;
        break;
      default:
        switch (oldState.state) {
          case 'armed_home':
            targetState = this.targetStayArm;
            break;
          case 'armed_away':
            targetState = this.targetAwayArm;
            break;
          case 'armed_night':
            targetState = this.targetNightArm;
            break;
          case 'disarmed':
            targetState = this.targetDisarm;
            break;
          default:
            targetState = this.targetDisarm;
            break;
        }
        break;
    }
    this.securitySystemService.getCharacteristic(Characteristic.SecuritySystemTargetState)
      .setValue(targetState, null, 'internal');

    if (newState.attributes.fault) {
      this.securitySystemService.getCharacteristic(Characteristic.StatusFault)
        .setValue(newState.attributes.fault ? this.generalFault : this.noFault, null, 'internal');
    }

    if (newState.attributes.tampered) {
      this.securitySystemService.getCharacteristic(Characteristic.StatusTampered)
        .setValue(newState.attributes.tampered ? this.tampered : this.notTampered, null, 'internal');
    }
  },

  identify(callback) {
    this.log(`Identifying: '${this.name}'`);

    callback();
  },

  getSecuritySystemCurrentState(callback) {
    const that = this;

    this.log(`Fetching security system current state for: '${this.name}'`);

    this.client.fetchState(this.entity_id, (data) => {
      if (data) {
        let currentState;
        switch (data.state) {
          case 'armed_home':
            currentState = this.currentStayArm;
            break;
          case 'armed_away':
            currentState = this.currentAwayArm;
            break;
          case 'armed_night':
            currentState = this.currentNightArm;
            break;
          case 'disarmed':
            currentState = this.currentDisarmed;
            break;
          case 'triggered':
            currentState = this.currentTriggered;
            break;
          default:
            currentState = this.currentDisarmed;
            break;
        }
        that.log(`Successfully fetched security system current state: '${data.state}' for: '${that.name}'`);
        callback(null, currentState);
      } else {
        callback(communicationError);
      }
    });
  },

  getSecuritySystemTargetState(callback) {
    const that = this;

    this.log(`Fetching security system target state for: '${this.name}'`);

    this.client.fetchState(this.entity_id, (data) => {
      if (data) {
        let targetState;
        switch (data.state) {
          case 'armed_home':
            targetState = this.targetStayArm;
            break;
          case 'armed_away':
            targetState = this.targetAwayArm;
            break;
          case 'armed_night':
            targetState = this.targetNightArm;
            break;
          case 'disarmed':
            targetState = this.targetDisarm;
            break;
          default:
            targetState = this.targetDisarm;
            break;
        }
        that.log(`Successfully fetched security system target state: '${data.state}' for: '${that.name}'`);
        callback(null, targetState);
      } else {
        callback(communicationError);
      }
    });
  },

  setSecuritySystemTargetState(targetState, callback, context) {
    if (context === 'internal') {
      callback();
      return;
    }

    const that = this;

    let service;
    switch (targetState) {
      case this.targetStayArm:
        service = 'alarm_arm_home';
        break;
      case this.targetAwayArm:
        service = 'alarm_arm_away';
        break;
      case this.targetNightArm:
        service = 'alarm_arm_night';
        break;
      case this.targetDisarm:
        service = 'alarm_disarm';
        break;
      default:
        service = 'alarm_disarm';
        break;
    }

    const serviceData = {};

    serviceData.entity_id = this.entity_id;

    if (this.alarmCode) {
      serviceData.code = this.alarmCode;
    }

    this.log(`Setting security system target state for: '${this.name}' to: '${service}'`);

    this.client.callService(this.domain, service, serviceData, (data) => {
      if (data) {
        that.log(`Successfully set security system target state for: '${that.name}' to: '${service}'`);
        callback();
      } else {
        callback(communicationError);
      }
    });
  },

  getStatusFault(callback) {
    const that = this;

    this.log(`Fetching status fault for: '${this.name}'`);

    this.client.fetchState(this.entity_id, (data) => {
      if (data) {
        that.log(`Successfully fetched status fault: '${data.attributes.fault}' for: '${that.name}'`);
        callback(null, data.attributes.fault ? this.generalFault : this.noFault);
      } else {
        callback(communicationError);
      }
    });
  },

  getStatusTampered(callback) {
    const that = this;

    this.log(`Fetching status tampered for: '${this.name}'`);

    this.client.fetchState(this.entity_id, (data) => {
      if (data) {
        that.log(`Successfully fetched status tampered: '${data.attributes.tampered}' for: '${that.name}'`);
        callback(null, data.attributes.tampered ? this.tampered : this.notTampered);
      } else {
        callback(communicationError);
      }
    });
  },

  getServices() {
    const accessoryInformationService = new Service.AccessoryInformation();

    accessoryInformationService
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(Characteristic.Model, this.model)
      .setCharacteristic(Characteristic.Name, this.name)
      .setCharacteristic(Characteristic.SerialNumber, this.serial)
      .setCharacteristic(Characteristic.FirmwareRevision, this.firmware);

    accessoryInformationService
      .setCharacteristic(Characteristic.Identify)
      .on('set', this.identify.bind(this));

    this.securitySystemService = new Service.SecuritySystem();

    this.securitySystemService
      .setCharacteristic(Characteristic.Name, this.name);

    this.securitySystemService
      .getCharacteristic(Characteristic.SecuritySystemCurrentState)
      .on('get', this.getSecuritySystemCurrentState.bind(this));

    this.securitySystemService
      .getCharacteristic(Characteristic.SecuritySystemTargetState)
      .on('get', this.getSecuritySystemTargetState.bind(this))
      .on('set', this.setSecuritySystemTargetState.bind(this));

    if (this.data.attributes.fault) {
      this.securitySystemService
        .addCharacteristic(Characteristic.StatusFault)
        .on('get', this.getStatusFault.bind(this));
    }

    if (this.data.attributes.tampered) {
      this.securitySystemService
        .addCharacteristic(Characteristic.StatusTampered)
        .on('get', this.getStatusTampered.bind(this));
    }
    return [accessoryInformationService, this.securitySystemService];
  }

};

function HomeAssistantAlarmControlPanelPlatform(oService, oCharacteristic, oCommunicationError) {
  Service = oService;
  Characteristic = oCharacteristic;
  communicationError = oCommunicationError;

  return HomeAssistantAlarmControlPanel;
}

module.exports = HomeAssistantAlarmControlPanelPlatform;
module.exports.HomeAssistantAlarmControlPanel = HomeAssistantAlarmControlPanel;
