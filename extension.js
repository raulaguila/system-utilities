const { GObject, St } = imports.gi;
const ByteArray = imports.byteArray;
const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

let interval;

const Indicator = GObject.registerClass(
  class Indicator extends PanelMenu.Button {
    _init() {
      super._init(0.0, _('Disk Usage Indicator'));

      this._loadLabels(this)
      this._loadDiskIcon(this)

      let diskTxt = new PopupMenu.PopupMenuItem("", { reactive: false })
      diskTxt.add_child(this.diskLbl);
      this.menu.addMenuItem(diskTxt);
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      let box = new St.BoxLayout({ style_class: 'system-status-icon-box' });
      box.add_child(this.storageIcon);
      box.add_child(this.percentLbl);
      this.add_child(box);

      this.menu.connect("open-state-changed", this._extractDiskUsageInformations.bind(this));
      interval = window.setInterval(this._extractDiskUsageInformations.bind(this), 30000);
      this._extractDiskUsageInformations(this)
    }

    async _loadDiskIcon() {
      const gicon = Gio.icon_new_for_string(
        Me.path + "/icons/storage_disk.svg"
      );

      this.storageIcon = new St.Icon({ gicon: gicon, style_class: "system-status-icon", icon_size: "16" });
    }

    async _loadLabels() {
      this.percentLbl = new St.Label({ style_class: 'panel-button diskinfo-font', text: '' });
      this.diskLbl = new St.Label({ style_class: 'panel-button diskinfo-font', text: '' });
    }

    async _extractDiskUsageInformations() {
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
      } catch (error) {
        log("Error: " + error)
      }
    }
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
    clearInterval(interval);
    this._indicator.destroy();
    this._indicator = null;
  }
}

function init(meta) {
  return new Extension(meta.uuid);
}