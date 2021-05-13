const api_config = {
    name: "Jacob Blog API",
    server: "https://api.jacob.workers.dev",
    servers: ["https://api.jacob.workers.dev"],
    endpoints: {
        blog: {
            list: {
                path: "/blog/list",
                param: {},
                parser: (data) => JSON.parse(data),
            },
            post: {
                path: "/blog/post",
                param: {
                    id: {
                        required: true,
                        validate: (val) => typeof val == "string",
                    },
                },
                parser: (data) => JSON.parse(data),
            },
            search: {
                path: "/blog/search",
                param: {
                    tag: {
                        required: true,
                        validate: (val) => typeof val == "string",
                    },
                },
                parser: (data) => JSON.parse(data),
            },
        },
    },
};

function api_client(config) {
    // Set Self Access
    const self = this;

    // Set Settings
    self.settings = {
        log: true,
    };

    // Add Methods
    self.log = log;
    self.read_config = read_config;
    self.make_requests = make_requests;
    self.request = request;

    // Init Config
    self.read_config(config);

    // Generate Requests
    self.make_requests();
}

function log(...args) {
    console.log(`%c[API Client] `, `color:#ffc14f;`, args);
}

function read_config(config) {
    // Set Self Access
    const self = this;

    self.config = config;

    if (self.settings.log) {
        self.log("Read Config", self.config);
    }

    return self.config;
}

function make_requests() {
    // Set Self Access
    const self = this;
}

function is_endpoint(endpoint) {
    if (endpoint.path && endpoint.param) {
        return true;
    } else {
        return false;
    }
}

function request(endpoint) {
    // Set Self Access
    const self = this;

    self.go = (params) => {
        
    }
}
