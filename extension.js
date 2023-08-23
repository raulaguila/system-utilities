const { GObject, St } = imports.gi;
const ByteArray = imports.byteArray;
const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

let intervalDisk;
let intervalCPU;
let intervalMem;

const Indicator = GObject.registerClass(
  class Indicator extends PanelMenu.Button {
    _init() {
      super._init(0.0, _('Disk Usage Indicator'));

      this.lastCPUTotal = 0;
      this.lastCPUUsed = 0;

      this._loadLabels(this);
      this._loadDiskIcon(this);
      this._loadCPUIcon(this);
      this._loadRAMIcon(this);

      let diskTxt = new PopupMenu.PopupMenuItem("", { reactive: false });
      diskTxt.add_child(this.diskLbl);
      this.menu.addMenuItem(diskTxt);
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      let box = new St.BoxLayout({ style_class: 'system-status-icon-box' });
      box.add_child(this.storageIcon);
      box.add_child(this.percentLbl);
      box.add_child(this.cpuIcon);
      box.add_child(this.cpuLbl);
      box.add_child(this.ramIcon);
      box.add_child(this.memLbl);
      this.add_child(box);

      intervalDisk = window.setInterval(this._extractDiskUsage.bind(this), 1000);
      intervalCPU = window.setInterval(this._extractCPUUsage.bind(this), 1000);
      intervalMem = window.setInterval(this._extractMemoryUsage.bind(this), 1000);
    }

    async _loadDiskIcon() {
      const gicon = Gio.icon_new_for_string(
        Me.path + "/icons/storage_disk.svg"
      );

      this.storageIcon = new St.Icon({ gicon: gicon, style_class: "system-status-icon", icon_size: "16" });
    }

    async _loadCPUIcon() {
      const gicon = Gio.icon_new_for_string(
        Me.path + "/icons/cpu.svg"
      );

      this.cpuIcon = new St.Icon({ gicon: gicon, style_class: "system-status-icon", icon_size: "16" });
    }

    async _loadRAMIcon() {
      const gicon = Gio.icon_new_for_string(
        Me.path + "/icons/ram.svg"
      );

      this.ramIcon = new St.Icon({ gicon: gicon, style_class: "system-status-icon", icon_size: "16" });
    }

    async _loadLabels() {
      this.percentLbl = new St.Label({ style_class: 'panel-button text-font', text: '' });
      this.diskLbl = new St.Label({ style_class: 'panel-button text-font', text: '' });
      this.cpuLbl = new St.Label({ style_class: 'panel-button text-font', text: '' });
      this.memLbl = new St.Label({ style_class: 'panel-button text-font', text: '' });
    }

    async _extractDiskUsage() {
      try {
        let _spaceIndex = 0
        let _one = false
        let _two = false
        let _sizeText = ""
        let _usedText = ""
        let _availableText = ""

        let [, out, ,] = GLib.spawn_command_line_sync('df -h /');
        let result = ByteArray.toString(out).substring(ByteArray.toString(out).indexOf("/") + 1)

        for (let i = 0; i < result.length; i++) {
          if (result[i] === ' ') {
            _spaceIndex = i

          } else if (result[i] === '%' && _spaceIndex > 0) {
            this.percentLbl.set_text(result.substring(_spaceIndex + 1, i + 1).trim())

          } else if (result[i] === 'G' && _spaceIndex > 0) {
            if (!_one) {
              _sizeText = result.substring(_spaceIndex + 1, i + 1).trim()
              _one = true
              continue
            }
            if (!_two) {
              _usedText = result.substring(_spaceIndex + 1, i + 1).trim()
              _two = true
              continue
            }
            _availableText = result.substring(_spaceIndex + 1, i + 1).trim()
          }
        }

        this.diskLbl.set_text("Size: " + _sizeText + "\n" + "Usage: " + _usedText + "\n" + "Available: " + _availableText);
      } catch (e) {
        logError(e);
      }
    }

    async _extractCPUUsage() {
      try {
        const inputFile = Gio.File.new_for_path('/proc/stat');
        const [, content] = inputFile.load_contents(null);
        const contentStr = ByteArray.toString(content);
        const contentLines = contentStr.split('\n');

        let currentCPUUsed = 0;
        let currentCPUTotal = 0;
        let currentCPUUsage = 0;

        for (const line of contentLines) {
          const fields = line.trim().split(/\W+/);

          if (fields.length < 2) {
            continue;
          }

          const itemName = fields[0];
          if (itemName == 'cpu' && fields.length >= 5) {
            const user = Number.parseInt(fields[1]);
            const system = Number.parseInt(fields[3]);
            const idle = Number.parseInt(fields[4]);
            currentCPUUsed = user + system;
            currentCPUTotal = user + system + idle;
            break;
          }
        }

        // Avoid divide by zero
        if (currentCPUTotal - this.lastCPUTotal !== 0) {
          currentCPUUsage = (currentCPUUsed - this.lastCPUUsed) / (currentCPUTotal - this.lastCPUTotal);
        }

        this.lastCPUTotal = currentCPUTotal;
        this.lastCPUUsed = currentCPUUsed;

        this.cpuLbl.set_text(Math.round(currentCPUUsage * 100) + "%");
      } catch (e) {
        logError(e);
      }
    }

    async _extractMemoryUsage() {
      try {
        const inputFile = Gio.File.new_for_path('/proc/meminfo');
        const [, content] = inputFile.load_contents(null);
        const contentStr = ByteArray.toString(content);
        const contentLines = contentStr.split('\n');

        let memTotal = -1;
        let memAvailable = -1;
        let currentMemoryUsage = 0;

        for (const line of contentLines) {
          const fields = line.trim().split(/\W+/);

          if (fields.length < 2) {
            break;
          }

          const itemName = fields[0];
          const itemValue = Number.parseInt(fields[1]);

          if (itemName == 'MemTotal') {
            memTotal = itemValue;
          }

          if (itemName == 'MemAvailable') {
            memAvailable = itemValue;
          }

          if (memTotal !== -1 && memAvailable !== -1) {
            break;
          }
        }

        if (memTotal !== -1 && memAvailable !== -1) {
          const memUsed = memTotal - memAvailable;
          currentMemoryUsage = memUsed / memTotal;
        }

        this.memLbl.set_text(Math.round(currentMemoryUsage * 100) + "%");
      } catch (e) {
        logError(e);
      }
    };
  }
);

class Extension {
  constructor(uuid) {
    this._uuid = uuid;
  }

  enable() {
    this._indicator = new Indicator();
    Main.panel.addToStatusArea(this._uuid, this._indicator);
  }

  disable() {
    clearInterval(intervalDisk);
    clearInterval(intervalCPU);
    clearInterval(intervalMem);
    this._indicator.destroy();
    this._indicator = null;
  }
}

function init(meta) {
  return new Extension(meta.uuid);
}